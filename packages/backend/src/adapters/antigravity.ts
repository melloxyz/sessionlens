import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, AdapterCapabilities, Checkpoint, RawMessage, RawSession } from './types.js';
import type { CliProvider } from '@sessionlens/shared';

const ANTIGRAVITY_ROOT = join(homedir(), '.gemini', 'antigravity');
const ANTIGRAVITY_CAPABILITIES: AdapterCapabilities = {
  messages: 'partial',
  tokens: 'unavailable',
  cost: 'unavailable',
  model: 'unknown',
  provider: 'unknown',
  projectPath: 'unknown',
  duration: 'unknown',
  toolCalls: 'unavailable',
  fileReads: 'unavailable',
  fileWrites: 'unavailable',
  multiModel: 'unknown',
};

export function createAntigravityAdapter(): Adapter {
  return {
    cli: 'antigravity' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(ANTIGRAVITY_ROOT);
    },

    async discover(): Promise<string[]> {
      if (!existsSync(ANTIGRAVITY_ROOT)) return [];
      const files = new Set<string>();
      scan(ANTIGRAVITY_ROOT, 4, files);
      return [...files];
    },

    async watchPaths(): Promise<string[]> {
      return existsSync(ANTIGRAVITY_ROOT) ? [ANTIGRAVITY_ROOT] : [];
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      if (!existsSync(sessionPath)) return null;
      const stat = statSync(sessionPath);
      return {
        lastFileMtime: stat.mtimeMs,
        lastFileSize: stat.size,
        lastSessionId: null,
      };
    },

    async parse(sessionPath: string, checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];

      if (checkpoint !== null) {
        const stat = statSync(sessionPath);
        if (stat.mtimeMs === checkpoint.lastFileMtime && stat.size === checkpoint.lastFileSize) {
          return [];
        }
      }

      const raw = readFileSync(sessionPath, 'utf8').trim();
      if (!raw) return [];

      const messages: RawMessage[] = [];
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        messages.push({
          role: 'system',
          content: redactLine(line),
          timestamp: new Date().toISOString(),
        });
      }

      return [
        {
          sessionId: `antigravity-${hashString(sessionPath)}`,
          provider: 'antigravity',
          cli: 'antigravity' as CliProvider,
          projectPath: null,
          sourcePath: sessionPath,
          model: null,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: null,
          totalCostUsd: null,
          sourceConfidence: 'LOW',
          messages,
          usageEvents: [],
          dataQuality: {
            messages: messages.length > 0 ? 'partial' : 'unavailable',
            tokens: 'unavailable',
            cost: 'unknown',
            tools: 'unavailable',
            files: 'unavailable',
            model: 'unknown',
            projectPath: 'unknown',
          },
        },
      ];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },

    getCapabilities(): AdapterCapabilities {
      return ANTIGRAVITY_CAPABILITIES;
    },
  };
}

function scan(root: string, depth: number, out: Set<string>): void {
  if (!existsSync(root) || depth < 0) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isFile() && /^session-.*\.(json|jsonl)$/i.test(entry.name)) {
      out.add(full);
      continue;
    }
    if (entry.isDirectory() && depth > 0) {
      scan(full, depth - 1, out);
    }
  }
}

function redactLine(line: string): string {
  return line.length > 200 ? `${line.slice(0, 200)}...` : line;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}
