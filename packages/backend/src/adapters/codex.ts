import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  Adapter,
  AdapterCapabilities,
  Checkpoint,
  RawFileEvent,
  RawMessage,
  RawModelUsage,
  RawSession,
  RawToolEvent,
  RawUsageEvent,
} from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';
import { readString } from './shared.js';

const CODEX_HOME = join(homedir(), '.codex');
const STATE_DB = join(CODEX_HOME, 'state_5.sqlite');
const CODEX_CAPABILITIES: AdapterCapabilities = {
  messages: 'real',
  tokens: 'estimated',
  cost: 'estimated',
  model: 'real',
  provider: 'real',
  projectPath: 'real',
  duration: 'real',
  toolCalls: 'real',
  fileReads: 'partial',
  fileWrites: 'partial',
  multiModel: 'unavailable',
};

let sqlJsStatic: import('sql.js').SqlJsStatic | null = null;
async function getSqlJs(): Promise<import('sql.js').SqlJsStatic> {
  if (!sqlJsStatic) {
    const mod = await import('sql.js');
    sqlJsStatic = await mod.default();
  }
  return sqlJsStatic;
}

// Per-ingestion cache: opened once in onIngestionStart, closed in onIngestionEnd.
let _cachedDb: import('sql.js').Database | null = null;
let _threadCache: Map<string, ThreadRow> | null = null;

interface ThreadRow {
  id: string;
  rollout_path: string;
  created_at: number;
  updated_at: number;
  created_at_ms: number | null;
  updated_at_ms: number | null;
  model_provider: string;
  model: string | null;
  cwd: string;
  title: string;
  tokens_used: number;
  has_user_event: number;
  archived: number;
  git_origin_url: string | null;
  git_branch: string | null;
  source: string;
}

export function createCodexAdapter(): Adapter {
  return {
    cli: 'codex' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(STATE_DB);
    },

    async onIngestionStart(): Promise<void> {
      if (!existsSync(STATE_DB)) return;
      const sql = await getSqlJs();
      _cachedDb = new sql.Database(readFileSync(STATE_DB));
      _threadCache = loadAllThreads(_cachedDb);
    },

    async onIngestionEnd(): Promise<void> {
      _cachedDb?.close();
      _cachedDb = null;
      _threadCache = null;
    },

    async discover(): Promise<string[]> {
      const sql = await getSqlJs();
      if (!existsSync(STATE_DB)) return [];
      const ownDb = _cachedDb === null;
      const db = _cachedDb ?? new sql.Database(readFileSync(STATE_DB));

      const paths = new Set<string>();
      try {
        // Exclude archived threads — user intentionally removed them from Codex
        const results = db.exec(
          `SELECT rollout_path FROM threads WHERE rollout_path IS NOT NULL AND archived = 0`,
        );
        if (results.length > 0 && results[0].values) {
          for (const row of results[0].values) {
            if (typeof row[0] === 'string' && row[0].length > 0) {
              paths.add(row[0]);
            }
          }
        }
      } finally {
        if (ownDb) db.close();
      }
      return [...paths];
    },

    async watchPaths(): Promise<string[]> {
      return [CODEX_HOME];
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

      const raw = await readFile(sessionPath, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return [];

      const thread =
        _threadCache !== null
          ? (_threadCache.get(sessionPath) ?? null)
          : await getThreadData(sessionPath);
      if (!thread) return [];

      const events: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // skip malformed
        }
      }

      return buildSession(events, thread);
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },

    getCapabilities(): AdapterCapabilities {
      return CODEX_CAPABILITIES;
    },
  };
}

function buildSession(events: Record<string, unknown>[], thread: ThreadRow): RawSession[] {
  const messages: RawMessage[] = [];
  const usageEvents: RawUsageEvent[] = [];
  const toolEvents: RawToolEvent[] = [];
  const fileEvents: RawFileEvent[] = [];
  let firstTs = '';
  let lastTs = '';

  for (const evt of events) {
    const type = evt.type as string;
    const payload = (evt.payload ?? {}) as Record<string, unknown>;
    const ts = (evt.timestamp as string) ?? '';

    if (ts) {
      if (!firstTs || ts < firstTs) firstTs = ts;
      if (!lastTs || ts > lastTs) lastTs = ts;
    }

    if (type === 'response_item') {
      const pt = payload.type as string;
      if (pt === 'message') {
        const role = (payload.role as string) ?? 'assistant';
        const content = extractContent(payload.content);
        if (content) {
          messages.push({ role: role as RawMessage['role'], content, timestamp: ts });
        }
      } else if (pt === 'function_call' || pt === 'custom_tool_call') {
        const toolName = String(payload.name ?? payload.tool_name ?? 'unknown');
        const input = parseArguments(payload.arguments);
        toolEvents.push({
          timestamp: ts,
          toolName,
          operation: inferToolOperation(toolName),
          input,
          outputPreview: null,
          sourceConfidence: toolName === 'shell_command' ? 'low' : 'medium',
        });
        fileEvents.push(...inferFileEvents(toolName, input, ts));
      }
      if (payload.usage) {
        const usage = payload.usage as Record<string, unknown>;
        usageEvents.push({
          timestamp: ts,
          inputTokens: Number(usage.input_tokens) || 0,
          outputTokens: Number(usage.output_tokens) || 0,
          cacheReadTokens: Number(usage.cache_read_input_tokens) || 0,
          cacheWriteTokens: Number(usage.cache_creation_input_tokens) || 0,
          reasoningTokens: Number(usage.reasoning_tokens) || 0,
          toolCallsCount: 0,
        });
      }
    } else if (type === 'event_msg') {
      const pt = payload.type as string;
      const text = (payload.text as string) ?? '';
      if (pt === 'user_message' && text) {
        messages.push({ role: 'user', content: text, timestamp: ts });
      } else if (pt === 'agent_message' && text) {
        messages.push({ role: 'assistant', content: text, timestamp: ts });
      }
    }
  }

  const totalTokens = thread.tokens_used ?? 0;
  if (totalTokens > 0 && usageEvents.length === 0) {
    usageEvents.push({
      timestamp: firstTs || new Date().toISOString(),
      inputTokens: Math.floor(totalTokens * 0.7),
      outputTokens: Math.floor(totalTokens * 0.3),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      toolCallsCount: toolEvents.length,
    });
  }

  const startTime = thread.created_at_ms
    ? new Date(thread.created_at_ms).toISOString()
    : firstTs || new Date().toISOString();
  const endTime = thread.updated_at_ms
    ? new Date(thread.updated_at_ms).toISOString()
    : lastTs || startTime;
  const durationMs =
    thread.created_at_ms && thread.updated_at_ms
      ? thread.updated_at_ms - thread.created_at_ms
      : null;

  const confidence: SourceConfidence =
    messages.length > 0 || toolEvents.length > 0 ? 'HIGH' : totalTokens > 0 ? 'MEDIUM' : 'LOW';
  // Let the costing engine price from real tokens via findPricing; never pre-estimate here.
  // usageEvents already holds either real per-event tokens or the 70/30 fallback when
  // only thread.tokens_used is available — the engine will use those for estimation.
  const modelUsage: RawModelUsage[] =
    messages.length > 0 || totalTokens > 0 || toolEvents.length > 0
      ? [
          {
            provider: thread.model_provider ?? 'openai',
            model: thread.model ?? 'unknown',
            messageCount: messages.length,
            inputTokens: usageEvents.reduce((sum, item) => sum + item.inputTokens, 0),
            outputTokens: usageEvents.reduce((sum, item) => sum + item.outputTokens, 0),
            reasoningTokens: usageEvents.reduce((sum, item) => sum + item.reasoningTokens, 0),
            cacheReadTokens: usageEvents.reduce((sum, item) => sum + item.cacheReadTokens, 0),
            cacheWriteTokens: usageEvents.reduce((sum, item) => sum + item.cacheWriteTokens, 0),
            toolCallsCount: toolEvents.length,
            totalCostUsd: 0,
          },
        ]
      : [];

  return [
    {
      sessionId: thread.id,
      provider: thread.model_provider ?? 'openai',
      cli: 'codex',
      projectPath: thread.cwd ? thread.cwd.replace(/^\\\\\?\\/, '') : null,
      sourcePath: thread.rollout_path,
      model: thread.model,
      startedAt: startTime,
      endedAt: endTime,
      durationMs,
      totalCostUsd: null,
      sourceConfidence: confidence,
      messages,
      usageEvents,
      modelUsage,
      toolEvents,
      fileEvents,
      title: thread.title || null,
      gitOriginUrl: thread.git_origin_url || null,
      gitBranch: thread.git_branch || null,
      dataQuality: {
        messages: messages.length > 0 ? 'real' : 'unavailable',
        tokens: totalTokens > 0 ? 'estimated' : 'unavailable',
        cost: totalTokens > 0 ? 'estimated' : 'unknown',
        tools: toolEvents.length > 0 ? 'real' : 'unavailable',
        files: fileEvents.length > 0 ? 'heuristic' : 'unavailable',
        model: thread.model ? 'real' : 'unknown',
        projectPath: thread.cwd ? 'real' : 'unknown',
      },
    },
  ];
}

function extractContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, unknown>) => c.type === 'output_text' || c.type === 'input_text')
      .map((c: Record<string, unknown>) => String(c.text ?? ''))
      .join('\n');
  }
  return '';
}

function parseArguments(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { raw };
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function inferToolOperation(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read') || normalized.includes('view')) return 'read';
  if (normalized.includes('write')) return 'write';
  if (normalized.includes('edit') || normalized.includes('patch')) return 'edit';
  if (normalized.includes('shell') || normalized.includes('command')) return 'shell';
  return 'unknown';
}

function inferFileEvents(
  toolName: string,
  input: Record<string, unknown> | null,
  timestamp: string,
): RawFileEvent[] {
  if (!input) return [];

  const directPath =
    readString(input.absolutePath) ??
    readString(input.filePath) ??
    readString(input.path) ??
    readString(input.imagePath) ??
    readString(input.directory) ??
    readString(input.workdir) ??
    null;
  const paths = Array.isArray(input.paths)
    ? input.paths.filter((item): item is string => typeof item === 'string')
    : [];
  const operation = inferFileOperation(toolName);
  const confidence =
    operation === 'shell_possible' ? 'low' : operation === 'unknown' ? 'medium' : 'high';
  const results: RawFileEvent[] = [];

  for (const path of directPath ? [directPath, ...paths] : paths) {
    results.push({
      path,
      operation,
      toolName,
      timestamp,
      confidence,
      metadata: input,
    });
  }

  return results;
}

function inferFileOperation(toolName: string): RawFileEvent['operation'] {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read') || normalized.includes('view')) return 'read';
  if (normalized.includes('write')) return 'write';
  if (normalized.includes('edit') || normalized.includes('patch')) return 'edit';
  if (normalized.includes('shell') || normalized.includes('command')) return 'shell_possible';
  return 'unknown';
}

function loadAllThreads(db: import('sql.js').Database): Map<string, ThreadRow> {
  const map = new Map<string, ThreadRow>();
  const results = db.exec(
    `SELECT id, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms,
     model_provider, model, cwd, title, tokens_used, has_user_event, archived,
     git_origin_url, git_branch, source FROM threads WHERE rollout_path IS NOT NULL`,
  );
  if (!results[0]?.values) return map;
  for (const r of results[0].values) {
    const thread: ThreadRow = {
      id: r[0] as string,
      rollout_path: r[1] as string,
      created_at: r[2] as number,
      updated_at: r[3] as number,
      created_at_ms: (r[4] ?? null) as number | null,
      updated_at_ms: (r[5] ?? null) as number | null,
      model_provider: r[6] as string,
      model: (r[7] ?? null) as string | null,
      cwd: r[8] as string,
      title: r[9] as string,
      tokens_used: r[10] as number,
      has_user_event: r[11] as number,
      archived: r[12] as number,
      git_origin_url: (r[13] ?? null) as string | null,
      git_branch: (r[14] ?? null) as string | null,
      source: r[15] as string,
    };
    map.set(thread.rollout_path, thread);
  }
  return map;
}

/** For testing only — injects a pre-built thread cache so parse() bypasses the real SQLite DB. */
export type { ThreadRow };
export function _setTestThreadCache(cache: Map<string, ThreadRow> | null): void {
  _threadCache = cache;
}

async function getThreadData(sessionPath: string): Promise<ThreadRow | null> {
  const sql = await getSqlJs();
  const ownDb = _cachedDb === null;
  if (!existsSync(STATE_DB)) return null;
  const db: import('sql.js').Database = _cachedDb ?? new sql.Database(readFileSync(STATE_DB));
  try {
    const results = db.exec(
      `SELECT id, rollout_path, created_at, updated_at, created_at_ms, updated_at_ms, model_provider, model, cwd, title, tokens_used, has_user_event, archived, git_origin_url, git_branch, source FROM threads WHERE rollout_path = ? LIMIT 1`,
      [sessionPath],
    );
    if (results.length === 0 || !results[0].values || results[0].values.length === 0) return null;

    const r = results[0].values[0];
    return {
      id: r[0] as string,
      rollout_path: r[1] as string,
      created_at: r[2] as number,
      updated_at: r[3] as number,
      created_at_ms: (r[4] ?? null) as number | null,
      updated_at_ms: (r[5] ?? null) as number | null,
      model_provider: r[6] as string,
      model: (r[7] ?? null) as string | null,
      cwd: r[8] as string,
      title: r[9] as string,
      tokens_used: r[10] as number,
      has_user_event: r[11] as number,
      archived: r[12] as number,
      git_origin_url: (r[13] ?? null) as string | null,
      git_branch: (r[14] ?? null) as string | null,
      source: r[15] as string,
    };
  } finally {
    if (ownDb) db.close();
  }
}
