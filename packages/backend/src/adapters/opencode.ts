import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const OPENCODE_DB = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');
const OPENCODE_CAPABILITIES: AdapterCapabilities = {
  messages: 'real',
  tokens: 'real',
  cost: 'real',
  model: 'real',
  provider: 'real',
  projectPath: 'real',
  duration: 'real',
  toolCalls: 'real',
  fileReads: 'partial',
  fileWrites: 'partial',
  multiModel: 'real',
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

async function getOrOpenDb(): Promise<{ db: import('sql.js').Database; owned: boolean }> {
  if (_cachedDb !== null) return { db: _cachedDb, owned: false };
  const sql = await getSqlJs();
  return { db: new sql.Database(readFileSync(OPENCODE_DB)), owned: true };
}

interface SessionRow {
  id: string;
  directory: string | null;
  model: string | null;
  cost: number;
  tokens_input: number;
  tokens_output: number;
  tokens_reasoning: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  summary_files: number;
  summary_diffs: string | null;
  time_created: number;
  time_updated: number;
}

interface MessageRow {
  id: string;
  time_created: number;
  data: string;
}

interface PartRow {
  message_id: string;
  time_created: number;
  data: string;
}

export function createOpencodeAdapter(): Adapter {
  return {
    cli: 'opencode' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(OPENCODE_DB);
    },

    async onIngestionStart(): Promise<void> {
      if (!existsSync(OPENCODE_DB)) return;
      const sql = await getSqlJs();
      _cachedDb = new sql.Database(readFileSync(OPENCODE_DB));
    },

    async onIngestionEnd(): Promise<void> {
      _cachedDb?.close();
      _cachedDb = null;
    },

    async discover(): Promise<string[]> {
      const { db, owned } = await getOrOpenDb();
      const ids: string[] = [];
      try {
        const results = db.exec(
          `SELECT id FROM session WHERE time_archived IS NULL ORDER BY time_created DESC`,
        );
        if (results.length > 0 && results[0].values) {
          for (const row of results[0].values) ids.push(String(row[0]));
        }
      } finally {
        if (owned) db.close();
      }
      return ids;
    },

    async watchPaths(): Promise<string[]> {
      return [dirname(OPENCODE_DB)];
    },

    async computeCheckpoint(sessionId: string): Promise<Checkpoint | null> {
      const { db, owned } = await getOrOpenDb();
      try {
        const results = db.exec(`SELECT time_updated FROM session WHERE id = ?`, [sessionId]);
        if (results.length > 0 && results[0].values.length > 0) {
          const timeUpdated = Number(results[0].values[0][0]);
          return { lastFileMtime: timeUpdated, lastFileSize: 0, lastSessionId: sessionId };
        }
        return null;
      } finally {
        if (owned) db.close();
      }
    },

    async parse(sessionId: string, checkpoint: Checkpoint | null): Promise<RawSession[]> {
      const { db, owned } = await getOrOpenDb();

      try {
        if (checkpoint !== null) {
          const timeResults = db.exec(`SELECT time_updated FROM session WHERE id = ?`, [sessionId]);
          if (timeResults.length > 0 && timeResults[0].values.length > 0) {
            const timeUpdated = Number(timeResults[0].values[0][0]);
            if (timeUpdated === checkpoint.lastFileMtime) return [];
          }
        }

        const session = readSessionRow(db, sessionId);
        if (!session) return [];

        const messageRows = readMessageRows(db, sessionId);
        const partRows = readPartRows(db, sessionId);
        const partsByMessage = new Map<string, PartRow[]>();
        for (const row of partRows) {
          const current = partsByMessage.get(row.message_id) ?? [];
          current.push(row);
          partsByMessage.set(row.message_id, current);
        }

        const messages: RawMessage[] = [];
        const usageEvents: RawUsageEvent[] = [];
        const toolEvents: RawToolEvent[] = [];
        const fileEvents: RawFileEvent[] = buildSummaryFileEvents(session);
        const modelUsage = new Map<string, RawModelUsage>();

        let provider = 'opencode';
        let model = parseSessionModel(session.model).model;
        if (parseSessionModel(session.model).provider) {
          provider = parseSessionModel(session.model).provider!;
        }

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalReasoningTokens = 0;
        let totalCacheReadTokens = 0;
        let totalCacheWriteTokens = 0;
        // Accumulate message costs separately; session.cost is chosen as the total
        // only if > 0 (it is the authoritative aggregate from opencode.db).
        // The two must never be summed together — that would double-count.
        let messageCostTotal = 0;

        for (const row of messageRows) {
          let data: Record<string, unknown> | null = null;
          try {
            data = JSON.parse(row.data) as Record<string, unknown>;
          } catch {
            continue;
          }

          const role = normalizeRole(readString(data.role));
          const timestampMs =
            readNumber((data.time as Record<string, unknown> | undefined)?.created) ??
            row.time_created;
          const timestamp = new Date(timestampMs).toISOString();

          const providerId =
            readString(data.providerID) ??
            readString((data.model as Record<string, unknown> | undefined)?.providerID) ??
            provider;
          const modelId =
            readString(data.modelID) ??
            readString((data.model as Record<string, unknown> | undefined)?.modelID) ??
            model ??
            'unknown';

          provider = providerId;
          model = modelId === 'unknown' ? model : modelId;

          const tokens = parseTokenUsage(data.tokens);
          totalInputTokens += tokens.inputTokens;
          totalOutputTokens += tokens.outputTokens;
          totalReasoningTokens += tokens.reasoningTokens;
          totalCacheReadTokens += tokens.cacheReadTokens;
          totalCacheWriteTokens += tokens.cacheWriteTokens;

          const messageCost = readNumber(data.cost) ?? 0;
          messageCostTotal += messageCost;

          const partList = partsByMessage.get(row.id) ?? [];
          const contentParts: string[] = [];
          let messageToolCalls = 0;

          for (const part of partList) {
            let partData: Record<string, unknown> | null = null;
            try {
              partData = JSON.parse(part.data) as Record<string, unknown>;
            } catch {
              continue;
            }

            const normalized = normalizePart(partData, timestamp, session.directory);
            if (normalized.text) contentParts.push(normalized.text);
            if (normalized.toolEvent) {
              messageToolCalls += 1;
              toolEvents.push(normalized.toolEvent);
            }
            if (normalized.fileEvents.length > 0) {
              fileEvents.push(...normalized.fileEvents);
            }
          }

          if (contentParts.length > 0 && role) {
            messages.push({
              role,
              content: contentParts.join('\n'),
              timestamp,
            });
          }

          updateModelUsage(modelUsage, {
            provider: providerId,
            model: modelId,
            messageCount: role ? 1 : 0,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
            reasoningTokens: tokens.reasoningTokens,
            cacheReadTokens: tokens.cacheReadTokens,
            cacheWriteTokens: tokens.cacheWriteTokens,
            toolCallsCount: messageToolCalls,
            totalCostUsd: messageCost,
          });
        }

        if (totalInputTokens === 0 && session.tokens_input > 0)
          totalInputTokens = session.tokens_input;
        if (totalOutputTokens === 0 && session.tokens_output > 0) {
          totalOutputTokens = session.tokens_output;
        }
        if (totalReasoningTokens === 0 && session.tokens_reasoning > 0) {
          totalReasoningTokens = session.tokens_reasoning;
        }
        if (totalCacheReadTokens === 0 && session.tokens_cache_read > 0) {
          totalCacheReadTokens = session.tokens_cache_read;
        }
        if (totalCacheWriteTokens === 0 && session.tokens_cache_write > 0) {
          totalCacheWriteTokens = session.tokens_cache_write;
        }
        // Use exactly one cost source: session.cost when present (authoritative total),
        // otherwise fall back to the sum of per-message costs.
        const totalCostUsd = session.cost > 0 ? session.cost : messageCostTotal;

        const hasTokens =
          totalInputTokens > 0 ||
          totalOutputTokens > 0 ||
          totalReasoningTokens > 0 ||
          totalCacheReadTokens > 0 ||
          totalCacheWriteTokens > 0;
        const hasCost = totalCostUsd > 0;
        const confidence: SourceConfidence =
          hasCost || hasTokens
            ? 'HIGH'
            : messages.length > 0 || toolEvents.length > 0
              ? 'MEDIUM'
              : 'LOW';

        const startTime = new Date(session.time_created).toISOString();
        const endTime = new Date(session.time_updated).toISOString();
        const durationMs = session.time_updated - session.time_created;

        if (hasTokens) {
          usageEvents.push({
            timestamp: startTime,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheReadTokens: totalCacheReadTokens,
            cacheWriteTokens: totalCacheWriteTokens,
            reasoningTokens: totalReasoningTokens,
            toolCallsCount: toolEvents.length,
          });
        }

        if (
          messages.length === 0 &&
          usageEvents.length === 0 &&
          toolEvents.length === 0 &&
          fileEvents.length === 0 &&
          !hasCost
        ) {
          return [];
        }

        return [
          {
            sessionId: session.id,
            provider,
            cli: 'opencode',
            projectPath: session.directory,
            sourcePath: OPENCODE_DB,
            model,
            startedAt: startTime,
            endedAt: endTime,
            durationMs,
            totalCostUsd: hasCost ? totalCostUsd : null,
            sourceConfidence: confidence,
            messages,
            usageEvents,
            modelUsage: [...modelUsage.values()],
            toolEvents,
            fileEvents: dedupeFileEvents(fileEvents),
            dataQuality: {
              messages: messages.length > 0 ? 'real' : 'unavailable',
              tokens: hasTokens ? 'real' : 'unavailable',
              cost: hasCost ? 'actual' : 'unknown',
              tools: toolEvents.length > 0 ? 'real' : 'unavailable',
              files: fileEvents.length > 0 ? 'real' : 'unavailable',
              model: model ? 'real' : 'unknown',
              projectPath: session.directory ? 'real' : 'unknown',
            },
          },
        ];
      } finally {
        if (owned) db.close();
      }
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },

    getCapabilities(): AdapterCapabilities {
      return OPENCODE_CAPABILITIES;
    },
  };
}

function readSessionRow(db: import('sql.js').Database, sessionId: string): SessionRow | null {
  const result = db.exec(
    `SELECT id, directory, model, cost, tokens_input, tokens_output, tokens_reasoning,
            tokens_cache_read, tokens_cache_write, summary_files, summary_diffs,
            time_created, time_updated
     FROM session WHERE id = ?`,
    [sessionId],
  );
  const row = result[0]?.values?.[0];
  if (!row) return null;
  return {
    id: String(row[0]),
    directory: readString(row[1]),
    model: readString(row[2]),
    cost: Number(row[3]) || 0,
    tokens_input: Number(row[4]) || 0,
    tokens_output: Number(row[5]) || 0,
    tokens_reasoning: Number(row[6]) || 0,
    tokens_cache_read: Number(row[7]) || 0,
    tokens_cache_write: Number(row[8]) || 0,
    summary_files: Number(row[9]) || 0,
    summary_diffs: readString(row[10]),
    time_created: Number(row[11]) || Date.now(),
    time_updated: Number(row[12]) || Number(row[11]) || Date.now(),
  };
}

function readMessageRows(db: import('sql.js').Database, sessionId: string): MessageRow[] {
  const result = db.exec(
    `SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created`,
    [sessionId],
  );
  return (result[0]?.values ?? []).map((row) => ({
    id: String(row[0]),
    time_created: Number(row[1]) || Date.now(),
    data: String(row[2]),
  }));
}

function readPartRows(db: import('sql.js').Database, sessionId: string): PartRow[] {
  const result = db.exec(
    `SELECT message_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created, rowid`,
    [sessionId],
  );
  return (result[0]?.values ?? []).map((row) => ({
    message_id: String(row[0]),
    time_created: Number(row[1]) || Date.now(),
    data: String(row[2]),
  }));
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  if (value === 'user' || value === 'assistant' || value === 'system' || value === 'tool') {
    return value;
  }
  return null;
}

function parseSessionModel(raw: string | null): { provider: string | null; model: string | null } {
  if (!raw) return { provider: null, model: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      provider: readString(parsed.providerID),
      model: readString(parsed.id) ?? readString(parsed.modelID),
    };
  } catch {
    if (raw.includes('/')) {
      const [provider, ...rest] = raw.split('/');
      return { provider, model: rest.join('/') || null };
    }
    return { provider: null, model: raw };
  }
}

function parseTokenUsage(value: unknown): {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
} {
  if (!value || typeof value !== 'object') {
    return {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
  }

  const tokens = value as Record<string, unknown>;
  const cache = tokens.cache as Record<string, unknown> | undefined;
  return {
    inputTokens: Number(tokens.input) || 0,
    outputTokens: Number(tokens.output) || 0,
    reasoningTokens: Number(tokens.reasoning) || 0,
    cacheReadTokens: Number(cache?.read) || 0,
    cacheWriteTokens: Number(cache?.write) || 0,
  };
}

function normalizePart(
  part: Record<string, unknown>,
  fallbackTimestamp: string,
  projectPath: string | null,
): {
  text: string | null;
  toolEvent: RawToolEvent | null;
  fileEvents: RawFileEvent[];
} {
  const type = readString(part.type) ?? 'unknown';
  if (type === 'text') {
    return {
      text: readString(part.text),
      toolEvent: null,
      fileEvents: [],
    };
  }

  if (type === 'tool' || type === 'tool_use' || type === 'tool_call') {
    const state = readObject(part.state) ?? {};
    const input = readObject(state.input) ?? readObject(part.input) ?? {};
    const metadata = readObject(state.metadata);
    const outputPreview =
      readString(state.output) ?? readString(metadata?.output) ?? readString(part.output) ?? null;
    const toolName =
      readString(part.tool) ?? readString(part.name) ?? readString(part.toolName) ?? 'unknown';
    const timestampMs =
      readNumber((readObject(state.time) ?? {}).start) ?? readNumber(part.time_created) ?? null;
    const timestamp = timestampMs ? new Date(timestampMs).toISOString() : fallbackTimestamp;
    const operation = inferToolOperation(toolName);
    const sourceConfidence = operation === 'shell' ? 'medium' : 'high';

    return {
      text: `[tool:${toolName}]`,
      toolEvent: {
        timestamp,
        toolName,
        operation,
        input,
        outputPreview,
        sourceConfidence,
      },
      fileEvents: inferFileEvents(toolName, input, timestamp, projectPath),
    };
  }

  return {
    text: null,
    toolEvent: null,
    fileEvents: [],
  };
}

function inferToolOperation(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read')) return 'read';
  if (normalized.includes('write') || normalized.includes('create')) return 'write';
  if (normalized.includes('edit') || normalized.includes('patch')) return 'edit';
  if (normalized.includes('delete') || normalized.includes('remove')) return 'delete';
  if (
    normalized.includes('bash') ||
    normalized.includes('shell') ||
    normalized.includes('command')
  ) {
    return 'shell';
  }
  return 'unknown';
}

function inferFileEvents(
  toolName: string,
  input: Record<string, unknown>,
  timestamp: string,
  projectPath: string | null,
): RawFileEvent[] {
  const directPaths = new Set<string>();
  for (const key of [
    'file',
    'file_path',
    'filepath',
    'path',
    'absolutePath',
    'target_file',
    'new_file',
  ]) {
    const value = readString(input[key]);
    if (value) directPaths.add(value);
  }

  for (const key of ['files', 'paths']) {
    const values = input[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value === 'string' && value.length > 0) directPaths.add(value);
    }
  }

  const operation = inferFileOperation(toolName);
  const confidence =
    operation === 'shell_possible' ? 'low' : operation === 'unknown' ? 'medium' : 'high';

  if (operation === 'shell_possible') {
    return [
      {
        path: readString(input.cwd) ?? readString(input.directory) ?? projectPath,
        operation,
        toolName,
        timestamp,
        confidence,
        metadata: input,
      },
    ];
  }

  return [...directPaths].map((path) => ({
    path,
    operation,
    toolName,
    timestamp,
    confidence,
    metadata: input,
  }));
}

function inferFileOperation(toolName: string): RawFileEvent['operation'] {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read')) return 'read';
  if (normalized.includes('write') || normalized.includes('create')) return 'write';
  if (normalized.includes('edit') || normalized.includes('patch')) return 'edit';
  if (normalized.includes('delete') || normalized.includes('remove')) return 'delete';
  if (
    normalized.includes('bash') ||
    normalized.includes('shell') ||
    normalized.includes('command')
  ) {
    return 'shell_possible';
  }
  return 'unknown';
}

function buildSummaryFileEvents(session: SessionRow): RawFileEvent[] {
  const files = new Set<string>();
  if (session.summary_diffs) {
    for (const match of session.summary_diffs.matchAll(
      /(?:\+\+\+|---|diff --git a\/)(?:b\/)?([^\n\r\t ]+)/g,
    )) {
      const file = match[1]?.trim();
      if (file && file !== '/dev/null') files.add(file);
    }
  }

  return [...files].map((path) => ({
    path,
    operation: 'edit',
    toolName: 'summary_diff',
    timestamp: new Date(session.time_updated).toISOString(),
    confidence: 'high',
    metadata: {
      summaryFiles: session.summary_files,
      source: 'summary_diffs',
    },
  }));
}

function dedupeFileEvents(rows: RawFileEvent[]): RawFileEvent[] {
  const seen = new Set<string>();
  const deduped: RawFileEvent[] = [];
  for (const row of rows) {
    const key = [
      row.path ?? '',
      row.operation,
      row.toolName ?? '',
      row.timestamp,
      row.confidence,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function updateModelUsage(map: Map<string, RawModelUsage>, row: RawModelUsage): void {
  const key = `${row.provider}/${row.model}`;
  const current = map.get(key) ?? {
    provider: row.provider,
    model: row.model,
    messageCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCallsCount: 0,
    totalCostUsd: 0,
  };

  current.messageCount += row.messageCount;
  current.inputTokens += row.inputTokens;
  current.outputTokens += row.outputTokens;
  current.reasoningTokens += row.reasoningTokens;
  current.cacheReadTokens += row.cacheReadTokens;
  current.cacheWriteTokens += row.cacheWriteTokens;
  current.toolCallsCount += row.toolCallsCount;
  current.totalCostUsd += row.totalCostUsd;
  map.set(key, current);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** For testing only — injects an in-memory sql.js Database so parse() bypasses the real opencode.db. */
export function _setTestDb(database: import('sql.js').Database | null): void {
  _cachedDb = database;
}
