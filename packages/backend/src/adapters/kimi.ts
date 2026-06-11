import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Adapter, AdapterCapabilities, Checkpoint, RawMessage, RawSession } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

const KIMI_HOME = join(homedir(), '.kimi');
const KIMI_SESSION_ROOTS = [process.env.KIMI_SHARE_DIR, join(KIMI_HOME, 'sessions')].filter(
  (value): value is string => Boolean(value && value.trim()),
);
const KIMI_CAPABILITIES: AdapterCapabilities = {
  messages: 'real',
  tokens: 'partial',
  cost: 'unavailable',
  model: 'partial',
  provider: 'partial',
  projectPath: 'partial',
  duration: 'partial',
  toolCalls: 'partial',
  fileReads: 'unavailable',
  fileWrites: 'unavailable',
  multiModel: 'unknown',
};

export function createKimiAdapter(): Adapter {
  return {
    cli: 'kimi' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(KIMI_HOME);
    },

    async discover(): Promise<string[]> {
      const sessions = new Set<string>();
      for (const root of KIMI_SESSION_ROOTS) {
        if (!existsSync(root)) continue;
        scanForContextFiles(root, 4, sessions);
      }
      return [...sessions];
    },

    async watchPaths(): Promise<string[]> {
      return KIMI_SESSION_ROOTS.filter((root) => existsSync(root));
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

      const raw = readFileSync(sessionPath, 'utf-8');
      const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return [];

      const messages: RawMessage[] = [];
      let sessionId = `kimi-${hashString(sessionPath)}`;
      let model: string | null = null;
      let provider = 'moonshot';
      let projectPath =
        readString(readStateField(sessionPath, 'cwd')) ??
        readString(readStateField(sessionPath, 'workdir'));
      let startedAt = '';
      let endedAt = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let reasoningTokens = 0;
      let toolCalls = 0;

      for (const line of lines) {
        let event: Record<string, unknown> | null = null;
        try {
          event = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (!event) continue;

        sessionId =
          readString(event.session_id) ??
          readString(event.sessionId) ??
          readString(event.id) ??
          sessionId;
        model = readString(event.model) ?? readString(event.model_id) ?? model;
        provider = readString(event.provider) ?? readString(event.provider_id) ?? provider;
        projectPath = readString(event.cwd) ?? readString(event.workdir) ?? projectPath;
        startedAt = readString(event.started_at) ?? readString(event.timestamp) ?? startedAt;
        endedAt = readString(event.completed_at) ?? readString(event.timestamp) ?? endedAt;

        const role = normalizeRole(readString(event.role) ?? readString(event.type));
        const content = extractContent(event.content ?? event.text ?? event.message);
        if (role && content) {
          messages.push({
            role,
            content,
            timestamp: readString(event.timestamp) ?? new Date().toISOString(),
          });
        }

        inputTokens += Number(event.input_tokens ?? 0) || 0;
        outputTokens += Number(event.output_tokens ?? 0) || 0;
        reasoningTokens += Number(event.reasoning_tokens ?? 0) || 0;
        toolCalls += Number(event.tool_calls ?? event.toolCallsCount ?? 0) || 0;
      }

      const hasTokens = inputTokens > 0 || outputTokens > 0 || reasoningTokens > 0;
      const confidence: SourceConfidence = messages.length > 0 || hasTokens ? 'MEDIUM' : 'LOW';

      if (messages.length === 0 && !hasTokens) return [];

      return [
        {
          sessionId,
          provider,
          cli: 'kimi' as CliProvider,
          projectPath,
          sourcePath: sessionPath,
          model,
          startedAt: startedAt || new Date().toISOString(),
          endedAt: endedAt || startedAt || new Date().toISOString(),
          durationMs:
            startedAt && endedAt
              ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
              : null,
          totalCostUsd: null,
          sourceConfidence: confidence,
          messages,
          usageEvents:
            hasTokens || toolCalls > 0
              ? [
                  {
                    timestamp: startedAt || new Date().toISOString(),
                    inputTokens,
                    outputTokens,
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                    reasoningTokens,
                    toolCallsCount: toolCalls,
                  },
                ]
              : [],
          dataQuality: {
            messages: messages.length > 0 ? 'real' : 'unavailable',
            tokens: hasTokens ? 'real' : 'unavailable',
            cost: 'unknown',
            tools: toolCalls > 0 ? 'partial' : 'unavailable',
            files: 'unavailable',
            model: model ? 'real' : 'unknown',
            projectPath: projectPath ? 'real' : 'unknown',
          },
        },
      ];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },

    getCapabilities(): AdapterCapabilities {
      return KIMI_CAPABILITIES;
    },
  };
}

function scanForContextFiles(root: string, depth: number, out: Set<string>): void {
  if (!existsSync(root) || depth < 0) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isFile() && entry.name === 'context.jsonl') {
      out.add(full);
      continue;
    }
    if (entry.isDirectory() && depth > 0) {
      scanForContextFiles(full, depth - 1, out);
    }
  }
}

function readStateField(sessionPath: string, field: string): unknown {
  const statePath = join(sessionPath, '..', 'state.json');
  if (!existsSync(statePath)) return null;
  try {
    const data = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
    return data[field] ?? null;
  } catch {
    return null;
  }
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('user')) return 'user';
  if (lower.includes('assistant') || lower.includes('agent') || lower.includes('kimi')) {
    return 'assistant';
  }
  if (lower.includes('system')) return 'system';
  if (lower.includes('tool')) return 'tool';
  return null;
}

function extractContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as Record<string, unknown>).text ?? '');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return readString(obj.text) ?? '';
  }
  return '';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
