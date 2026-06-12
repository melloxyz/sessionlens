import { existsSync, statSync, watch, type FSWatcher } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { platform } from 'node:os';
import type { FastifyBaseLogger } from 'fastify';
import { getDbPath } from '../db/connection.js';
import { getBooleanSetting, setAppSetting } from '../db/settings.js';
import { registry } from '../adapters/registry.js';
import { isIngestionRunning, runIngestion } from './engine.js';

const AUTO_INGESTION_KEY = 'autoIngestion.enabled';
const DEBOUNCE_MS = 3_000;
const WATCH_REFRESH_MS = 60_000;
const PERIODIC_SCAN_MS = 5 * 60_000;
const SUPPORTS_RECURSIVE_WATCH = platform() === 'win32' || platform() === 'darwin';

interface AutoIngestionStatus {
  enabled: boolean;
  running: boolean;
  scheduled: boolean;
  watchedPaths: string[];
  watchedPathCount: number;
  debounceMs: number;
  periodicScanMs: number;
  lastTriggeredAt: string | null;
  lastTriggerReason: string | null;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastError: string | null;
}

let enabled = true;
let initialized = false;
let running = false;
let watchers: FSWatcher[] = [];
let watchedPaths: string[] = [];
let debounceTimer: NodeJS.Timeout | null = null;
let watchRefreshTimer: NodeJS.Timeout | null = null;
let periodicScanTimer: NodeJS.Timeout | null = null;
let log: FastifyBaseLogger | null = null;
let lastTriggeredAt: string | null = null;
let lastTriggerReason: string | null = null;
let lastRunStartedAt: string | null = null;
let lastRunCompletedAt: string | null = null;
let lastError: string | null = null;

export async function startAutoIngestion(logger?: FastifyBaseLogger): Promise<AutoIngestionStatus> {
  log = logger ?? log;
  enabled = getBooleanSetting(AUTO_INGESTION_KEY, true);
  initialized = true;
  if (enabled) {
    await refreshWatchers();
    startMaintenanceTimers();
  } else {
    stopWatchers();
    stopMaintenanceTimers();
  }
  return getAutoIngestionStatus();
}

export async function setAutoIngestionEnabled(nextEnabled: boolean): Promise<AutoIngestionStatus> {
  enabled = nextEnabled;
  setAppSetting(AUTO_INGESTION_KEY, String(nextEnabled));
  if (enabled) {
    await refreshWatchers();
    startMaintenanceTimers();
    scheduleAutoIngestion('auto-ingestion enabled');
  } else {
    stopWatchers();
    stopMaintenanceTimers();
    clearDebounce();
  }
  return getAutoIngestionStatus();
}

export function getAutoIngestionStatus(): AutoIngestionStatus {
  if (!initialized) {
    enabled = getBooleanSetting(AUTO_INGESTION_KEY, true);
  }
  return {
    enabled,
    running: running || isIngestionRunning(),
    scheduled: debounceTimer !== null,
    watchedPaths,
    watchedPathCount: watchedPaths.length,
    debounceMs: DEBOUNCE_MS,
    periodicScanMs: PERIODIC_SCAN_MS,
    lastTriggeredAt,
    lastTriggerReason,
    lastRunStartedAt,
    lastRunCompletedAt,
    lastError,
  };
}

async function refreshWatchers(): Promise<void> {
  if (!enabled) return;
  const nextPaths = await collectWatchPaths();
  if (samePaths(watchedPaths, nextPaths)) return;

  stopWatchers();
  watchedPaths = nextPaths;

  for (const path of watchedPaths) {
    try {
      const stat = statSync(path);
      const watcher = watch(
        path,
        { recursive: SUPPORTS_RECURSIVE_WATCH && stat.isDirectory() },
        (eventType, filename) => {
          const eventPath = filename ? join(path, String(filename)) : path;
          if (shouldIgnore(eventPath)) return;
          scheduleAutoIngestion(`${eventType}:${basename(String(filename || path))}`);
        },
      );
      watcher.on('error', (err) => log?.warn({ err, path }, 'Auto-ingestion watcher failed'));
      watchers.push(watcher);
    } catch (err) {
      log?.warn({ err, path }, 'Failed to watch CLI data path');
    }
  }
}

async function collectWatchPaths(): Promise<string[]> {
  const paths = new Set<string>();
  for (const adapter of registry.getAll()) {
    try {
      if (!(await adapter.detect()) || !adapter.watchPaths) continue;
      for (const path of await adapter.watchPaths()) {
        if (path && existsSync(path) && !shouldIgnore(path)) paths.add(resolve(path));
      }
    } catch (err) {
      log?.warn({ err, cli: adapter.cli }, 'Failed to collect CLI watch paths');
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function scheduleAutoIngestion(reason: string): void {
  if (!enabled) return;
  lastTriggeredAt = new Date().toISOString();
  lastTriggerReason = reason;
  clearDebounce();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runScheduledIngestion();
  }, DEBOUNCE_MS);
  debounceTimer.unref?.();
}

async function runScheduledIngestion(): Promise<void> {
  if (!enabled) return;
  if (running || isIngestionRunning()) {
    scheduleAutoIngestion('pending after active ingestion');
    return;
  }

  running = true;
  lastRunStartedAt = new Date().toISOString();
  lastError = null;
  try {
    await runIngestion();
    lastRunCompletedAt = new Date().toISOString();
    await refreshWatchers();
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    log?.error({ err }, 'Auto-ingestion run failed');
  } finally {
    running = false;
  }
}

function startMaintenanceTimers(): void {
  if (!watchRefreshTimer) {
    watchRefreshTimer = setInterval(() => void refreshWatchers(), WATCH_REFRESH_MS);
    watchRefreshTimer.unref?.();
  }
  if (!periodicScanTimer) {
    periodicScanTimer = setInterval(() => scheduleAutoIngestion('periodic scan'), PERIODIC_SCAN_MS);
    periodicScanTimer.unref?.();
  }
}

function stopMaintenanceTimers(): void {
  if (watchRefreshTimer) clearInterval(watchRefreshTimer);
  if (periodicScanTimer) clearInterval(periodicScanTimer);
  watchRefreshTimer = null;
  periodicScanTimer = null;
}

function stopWatchers(): void {
  for (const watcher of watchers) watcher.close();
  watchers = [];
  watchedPaths = [];
}

function clearDebounce(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
}

function shouldIgnore(path: string): boolean {
  const normalized = resolve(path).toLowerCase();
  const dbPath = resolve(getDbPath()).toLowerCase();
  return (
    normalized === dbPath ||
    normalized.endsWith('sessionlens.db') ||
    normalized.endsWith('sessionlens.db-journal')
  );
}

function samePaths(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((path, index) => path === b[index]);
}
