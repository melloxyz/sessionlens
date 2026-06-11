import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  Adapter,
  AdapterCapabilities,
  Checkpoint,
  RawFileEvent,
  RawMessage,
  RawSession,
  RawToolEvent,
} from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

const QWEN_SESSION_ROOTS = [
  join(homedir(), '.qwen', 'sessions'),
  join(homedir(), '.config', 'qwen', 'sessions'),
  join(homedir(), '.local', 'share', 'qwen', 'sessions'),
  process.env.APPDATA ? join(process.env.APPDATA, 'qwen', 'sessions') : null,
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'qwen', 'sessions') : null,
].filter((value): value is string => Boolean(value));

const QWEN_CAPABILITIES: AdapterCapabilities = {
  messages: 'real',
  tokens: 'partial',
  cost: 'unavailable',
  model: 'partial',
  provider: 'partial',
  projectPath: 'partial',
  duration: 'partial',
  toolCalls: 'partial',
  fileReads: 'partial',
  fileWrites: 'partial',
  multiModel: 'unknown',
};

export function createQwenAdapter(): Adapter {
  return {
    cli: 'qwen' as CliProvider,

    async detect(): Promise<boolean> {
      return QWEN_SESSION_ROOTS.some((root) => existsSync(root));
    },

    async discover(): Promise<string[]> {
      const paths = new Set<string>();
      for (const root of QWEN_SESSION_ROOTS) {
        if (!existsSync(root)) continue;
        scan(root, 4, paths);
      }
      return [...paths];
    },

    async watchPaths(): Promise<string[]> {
      return QWEN_SESSION_ROOTS.filter((root) => existsSync(root));
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

      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(sessionPath, 'utf-8'));
      } catch {
        return [];
      }

      const envelope = normalizeEnvelope(parsed);
      if (!envelope) return [];

      const messages: RawMessage[] = [];
      const toolEvents: RawToolEvent[] = [];
      const fileEvents: RawFileEvent[] = [];

      let sessionId = envelope.sessionId ?? `qwen-${hashString(sessionPath)}`;
      let provider = envelope.provider ?? 'qwen';
      let model = envelope.model;
      let projectPath = envelope.projectPath;
      let startedAt = envelope.startedAt ?? '';
      let endedAt = envelope.endedAt ?? '';
      let totalInput = envelope.inputTokens ?? 0;
      let totalOutput = envelope.outputTokens ?? 0;
      let totalReasoning = envelope.reasoningTokens ?? 0;
      let totalCost = envelope.totalCost ?? 0;

      for (const item of envelope.events) {
        sessionId = readString(item.sessionId) ?? readString(item.id) ?? sessionId;
        provider = readString(item.provider) ?? readString(item.providerId) ?? provider;
        model = readString(item.model) ?? readString(item.modelId) ?? model;
        projectPath =
          readString(item.projectPath) ??
          readString(item.cwd) ??
          readString(item.directory) ??
          projectPath;
        startedAt = readString(item.startedAt) ?? readString(item.timestamp) ?? startedAt;
        endedAt = readString(item.endedAt) ?? readString(item.timestamp) ?? endedAt;

        const role = normalizeRole(
          readString(item.role) ?? readString(item.type) ?? readString(item.kind),
        );
        const content = extractContent(item.content ?? item.message ?? item.text ?? item.parts);
        if (role && content) {
          messages.push({
            role,
            content,
            timestamp: readString(item.timestamp) ?? new Date().toISOString(),
          });
        }

        const usage = extractUsage(item.usage ?? item.tokens ?? item.metrics);
        if (usage) {
          totalInput += usage.input;
          totalOutput += usage.output;
          totalReasoning += usage.reasoning;
        }
        totalCost += Number(item.cost ?? item.totalCost ?? 0) || 0;

        const normalizedTool = normalizeToolEvent(
          item,
          readString(item.timestamp) ?? new Date().toISOString(),
        );
        if (normalizedTool) {
          toolEvents.push(normalizedTool.toolEvent);
          fileEvents.push(...normalizedTool.fileEvents);
        }
      }

      const hasTokens = totalInput > 0 || totalOutput > 0 || totalReasoning > 0;
      const confidence: SourceConfidence =
        messages.length > 0 || toolEvents.length > 0 ? 'MEDIUM' : hasTokens ? 'MEDIUM' : 'LOW';

      if (messages.length === 0 && toolEvents.length === 0 && !hasTokens && totalCost === 0) {
        return [];
      }

      return [
        {
          sessionId,
          provider,
          cli: 'qwen' as CliProvider,
          projectPath,
          sourcePath: sessionPath,
          model,
          startedAt: startedAt || new Date().toISOString(),
          endedAt: endedAt || startedAt || new Date().toISOString(),
          durationMs:
            startedAt && endedAt
              ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
              : null,
          totalCostUsd: totalCost > 0 ? totalCost : null,
          sourceConfidence: confidence,
          messages,
          usageEvents:
            hasTokens || toolEvents.length > 0
              ? [
                  {
                    timestamp: startedAt || new Date().toISOString(),
                    inputTokens: totalInput,
                    outputTokens: totalOutput,
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                    reasoningTokens: totalReasoning,
                    toolCallsCount: toolEvents.length,
                  },
                ]
              : [],
          toolEvents,
          fileEvents,
          dataQuality: {
            messages: messages.length > 0 ? 'real' : 'unavailable',
            tokens: hasTokens ? 'real' : 'unavailable',
            cost: totalCost > 0 ? 'estimated' : 'unknown',
            tools: toolEvents.length > 0 ? 'partial' : 'unavailable',
            files: fileEvents.length > 0 ? 'heuristic' : 'unavailable',
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
      return QWEN_CAPABILITIES;
    },
  };
}

function scan(root: string, depth: number, out: Set<string>): void {
  if (depth < 0 || !existsSync(root)) return;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isFile() && entry.name.endsWith('.json')) {
      out.add(full);
      continue;
    }
    if (entry.isDirectory() && depth > 0) {
      scan(full, depth - 1, out);
    }
  }
}

function normalizeEnvelope(value: unknown): {
  sessionId: string | null;
  provider: string | null;
  model: string | null;
  projectPath: string | null;
  startedAt: string | null;
  endedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalCost: number | null;
  events: Record<string, unknown>[];
} | null {
  if (Array.isArray(value)) {
    return {
      sessionId: null,
      provider: null,
      model: null,
      projectPath: null,
      startedAt: null,
      endedAt: null,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      totalCost: null,
      events: value.filter(isRecord),
    };
  }

  if (!isRecord(value)) return null;
  const events =
    toRecordArray(value.messages) ??
    toRecordArray(value.events) ??
    toRecordArray(value.history) ??
    [];

  return {
    sessionId: readString(value.sessionId) ?? readString(value.id),
    provider: readString(value.provider) ?? readString(value.providerId),
    model: readString(value.model) ?? readString(value.modelId),
    projectPath: readString(value.projectPath) ?? readString(value.cwd),
    startedAt: readString(value.startedAt) ?? readString(value.createdAt),
    endedAt: readString(value.endedAt) ?? readString(value.updatedAt),
    inputTokens: readNumber(value.inputTokens),
    outputTokens: readNumber(value.outputTokens),
    reasoningTokens: readNumber(value.reasoningTokens),
    totalCost: readNumber(value.cost) ?? readNumber(value.totalCost),
    events,
  };
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('user')) return 'user';
  if (lower.includes('assistant') || lower.includes('agent') || lower.includes('model')) {
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
      .map((item) => extractContent(item))
      .filter(Boolean)
      .join('\n');
  }
  if (isRecord(value)) {
    return readString(value.text) ?? readString(value.content) ?? '';
  }
  return '';
}

function extractUsage(value: unknown): {
  input: number;
  output: number;
  reasoning: number;
} | null {
  if (!isRecord(value)) return null;
  const input = readNumber(value.input_tokens) ?? readNumber(value.inputTokens) ?? 0;
  const output = readNumber(value.output_tokens) ?? readNumber(value.outputTokens) ?? 0;
  const reasoning = readNumber(value.reasoning_tokens) ?? readNumber(value.reasoningTokens) ?? 0;
  if (input === 0 && output === 0 && reasoning === 0) return null;
  return { input, output, reasoning };
}

function normalizeToolEvent(
  item: Record<string, unknown>,
  timestamp: string,
): { toolEvent: RawToolEvent; fileEvents: RawFileEvent[] } | null {
  const type = readString(item.type) ?? readString(item.role) ?? '';
  if (!type.toLowerCase().includes('tool')) return null;

  const toolName =
    readString(item.name) ?? readString(item.tool) ?? readString(item.toolName) ?? 'unknown';
  const args = isRecord(item.args) ? item.args : isRecord(item.input) ? item.input : {};

  return {
    toolEvent: {
      timestamp,
      toolName,
      operation: inferToolOperation(toolName),
      input: args,
      outputPreview: extractContent(item.result ?? item.output),
      sourceConfidence: 'medium',
    },
    fileEvents: inferFileEvents(toolName, args, timestamp),
  };
}

function inferToolOperation(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read')) return 'read';
  if (normalized.includes('write')) return 'write';
  if (normalized.includes('edit')) return 'edit';
  if (normalized.includes('delete')) return 'delete';
  if (normalized.includes('shell') || normalized.includes('command')) return 'shell';
  return 'unknown';
}

function inferFileEvents(
  toolName: string,
  args: Record<string, unknown>,
  timestamp: string,
): RawFileEvent[] {
  const operation = toolName.toLowerCase().includes('read')
    ? 'read'
    : toolName.toLowerCase().includes('write')
      ? 'write'
      : toolName.toLowerCase().includes('edit')
        ? 'edit'
        : toolName.toLowerCase().includes('delete')
          ? 'delete'
          : toolName.toLowerCase().includes('shell') || toolName.toLowerCase().includes('command')
            ? 'shell_possible'
            : 'unknown';

  const path = readString(args.path) ?? readString(args.filePath) ?? readString(args.absolutePath);
  if (!path && operation !== 'shell_possible') return [];

  return [
    {
      path: path ?? null,
      operation,
      toolName,
      timestamp,
      confidence: operation === 'shell_possible' ? 'low' : 'medium',
      metadata: args,
    },
  ];
}

function toRecordArray(value: unknown): Record<string, unknown>[] | null {
  return Array.isArray(value) ? value.filter(isRecord) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}
