import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
} from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

const GEMINI_HOME = join(homedir(), '.gemini');
const GEMINI_TMP = join(GEMINI_HOME, 'tmp');
const GEMINI_CAPABILITIES: AdapterCapabilities = {
  messages: 'real',
  tokens: 'real',
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

export function createGeminiAdapter(): Adapter {
  return {
    cli: 'gemini' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(GEMINI_HOME);
    },

    async discover(): Promise<string[]> {
      const sessions: string[] = [];
      if (!existsSync(GEMINI_TMP)) return sessions;

      for (const projectDir of readdirSync(GEMINI_TMP, { withFileTypes: true })) {
        if (!projectDir.isDirectory()) continue;
        const chatsPath = join(GEMINI_TMP, projectDir.name, 'chats');
        if (!existsSync(chatsPath)) continue;

        for (const entry of readdirSync(chatsPath, { withFileTypes: true })) {
          const full = join(chatsPath, entry.name);
          if (entry.isDirectory()) {
            for (const nested of readdirSync(full, { withFileTypes: true })) {
              const nestedFull = join(full, nested.name);
              if (nested.isFile() && isSessionFile(nested.name)) sessions.push(nestedFull);
            }
          } else if (entry.isFile() && isSessionFile(entry.name)) {
            sessions.push(full);
          }
        }
      }

      return sessions;
    },

    async watchPaths(): Promise<string[]> {
      return [GEMINI_TMP];
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

    async parse(sessionPath: string, _checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];
      const raw = readFileSync(sessionPath, 'utf-8');
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return [];

      const messages: RawMessage[] = [];
      const modelUsage = new Map<string, RawModelUsage>();
      const toolEvents: RawToolEvent[] = [];
      const fileEvents: RawFileEvent[] = [];

      let sessionId = 'unknown';
      let provider = 'google';
      let model: string | null = null;
      let projectPath = readProjectRoot(sessionPath);
      let startedAt = '';
      let endedAt = '';
      let totalInput = 0;
      let totalOutput = 0;
      let totalReasoning = 0;
      let totalCacheRead = 0;
      let totalCacheWrite = 0;
      let toolCalls = 0;
      let totalCost = 0;

      for (const line of lines) {
        let data: Record<string, unknown> | null = null;
        try {
          data = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (!data) continue;

        sessionId = pickString(data.sessionId) ?? pickString(data.id) ?? sessionId;
        provider = pickString(data.provider) ?? pickString(data.providerId) ?? provider;
        model = pickString(data.model) ?? pickString(data.modelId) ?? model;
        projectPath =
          pickString(data.projectPath) ??
          pickString(data.cwd) ??
          pickString(data.path) ??
          projectPath;
        startedAt =
          pickString(data.startTime) ??
          pickString(data.startedAt) ??
          pickString(data.timestamp) ??
          startedAt;
        endedAt =
          pickString(data.lastUpdated) ??
          pickString(data.endedAt) ??
          pickString(data.timestamp) ??
          endedAt;

        const role = normalizeRole(pickString(data.role) ?? pickString(data.type));
        const content = extractContent(data.content ?? data.text ?? data.message);
        const timestamp = pickString(data.timestamp) ?? startedAt ?? new Date().toISOString();
        if (role && content) {
          messages.push({
            role,
            content,
            timestamp,
          });
        }

        const usage = extractUsage(data.tokens ?? data.usage ?? data.tokenUsage);
        if (usage) {
          totalInput += usage.input;
          totalOutput += usage.output;
          totalReasoning += usage.reasoning;
          totalCacheRead += usage.cacheRead;
          totalCacheWrite += usage.cacheWrite;
          toolCalls += usage.toolCalls;
        }

        const cost = Number(data.cost ?? data.totalCost ?? 0) || 0;
        totalCost += cost;

        if (Array.isArray(data.toolCalls)) {
          for (const tool of data.toolCalls) {
            const normalized = normalizeToolCall(tool, timestamp, projectPath);
            if (!normalized) continue;
            toolCalls += 1;
            toolEvents.push(normalized.toolEvent);
            fileEvents.push(...normalized.fileEvents);
          }
        }

        const providerId = provider || 'google';
        const modelId = model || 'unknown';
        updateModelUsage(modelUsage, {
          provider: providerId,
          model: modelId,
          messageCount: role ? 1 : 0,
          inputTokens: usage?.input ?? 0,
          outputTokens: usage?.output ?? 0,
          reasoningTokens: usage?.reasoning ?? 0,
          cacheReadTokens: usage?.cacheRead ?? 0,
          cacheWriteTokens: usage?.cacheWrite ?? 0,
          toolCallsCount: Array.isArray(data.toolCalls)
            ? data.toolCalls.length
            : (usage?.toolCalls ?? 0),
          totalCostUsd: cost,
        });
      }

      const hasTokens =
        totalInput > 0 ||
        totalOutput > 0 ||
        totalReasoning > 0 ||
        totalCacheRead > 0 ||
        totalCacheWrite > 0;
      const hasCost = totalCost > 0;
      const confidence: SourceConfidence =
        hasTokens || hasCost || toolEvents.length > 0
          ? 'HIGH'
          : messages.length > 0
            ? 'MEDIUM'
            : 'LOW';
      const totalTokens = totalInput + totalOutput;
      const costEstimate = hasCost ? totalCost : estimateGeminiCost(totalInput, totalOutput, model);

      if (!messages.length && !hasTokens && toolEvents.length === 0 && costEstimate === 0)
        return [];

      return [
        {
          sessionId,
          provider,
          cli: 'gemini',
          projectPath,
          sourcePath: sessionPath,
          model,
          startedAt: startedAt || new Date().toISOString(),
          endedAt: endedAt || startedAt || new Date().toISOString(),
          durationMs:
            startedAt && endedAt
              ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
              : null,
          totalCostUsd: costEstimate > 0 ? costEstimate : null,
          sourceConfidence: confidence,
          messages,
          usageEvents:
            totalTokens > 0 || toolEvents.length > 0
              ? [
                  {
                    timestamp: startedAt || new Date().toISOString(),
                    inputTokens: totalInput,
                    outputTokens: totalOutput,
                    cacheReadTokens: totalCacheRead,
                    cacheWriteTokens: totalCacheWrite,
                    reasoningTokens: totalReasoning,
                    toolCallsCount: toolEvents.length > 0 ? toolEvents.length : toolCalls,
                  },
                ]
              : [],
          modelUsage: [...modelUsage.values()],
          toolEvents,
          fileEvents: dedupeFileEvents(fileEvents),
          dataQuality: {
            messages: messages.length > 0 ? 'real' : 'unavailable',
            tokens: hasTokens ? 'real' : 'unavailable',
            cost: costEstimate > 0 ? 'estimated' : 'unknown',
            tools: toolEvents.length > 0 ? 'real' : 'unavailable',
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
      return GEMINI_CAPABILITIES;
    },
  };
}

function isSessionFile(name: string): boolean {
  return name.endsWith('.jsonl') || name.endsWith('.json');
}

function readProjectRoot(sessionPath: string): string | null {
  const projectRootFile = join(dirname(dirname(sessionPath)), '.project_root');
  if (!existsSync(projectRootFile)) return null;
  const value = readFileSync(projectRootFile, 'utf8').trim();
  return value.length > 0 ? value : null;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('user')) return 'user';
  if (lower.includes('assistant') || lower.includes('model') || lower.includes('gemini'))
    return 'assistant';
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
        if (item && typeof item === 'object' && 'text' in item)
          return String((item as Record<string, unknown>).text ?? '');
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return typeof obj.text === 'string' ? obj.text : '';
  }
  return '';
}

function extractUsage(value: unknown): {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  toolCalls: number;
} | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const input =
    Number(obj.input_tokens ?? obj.inputTokens ?? obj.input ?? obj.prompt_tokens ?? 0) || 0;
  const output =
    Number(obj.output_tokens ?? obj.outputTokens ?? obj.output ?? obj.completion_tokens ?? 0) || 0;
  const reasoning = Number(obj.reasoning_tokens ?? obj.reasoningTokens ?? obj.thoughts ?? 0) || 0;
  const cacheRead =
    Number(obj.cached_tokens ?? obj.cache_read_tokens ?? obj.cacheReadTokens ?? obj.cached ?? 0) ||
    0;
  const cacheWrite = Number(obj.cache_write_tokens ?? obj.cacheWriteTokens ?? 0) || 0;
  const toolCalls = Number(obj.tool_calls_count ?? obj.toolCallsCount ?? obj.tool ?? 0) || 0;
  if (
    input === 0 &&
    output === 0 &&
    reasoning === 0 &&
    cacheRead === 0 &&
    cacheWrite === 0 &&
    toolCalls === 0
  ) {
    return null;
  }
  return { input, output, reasoning, cacheRead, cacheWrite, toolCalls };
}

function normalizeToolCall(
  value: unknown,
  fallbackTimestamp: string,
  projectPath: string | null,
): { toolEvent: RawToolEvent; fileEvents: RawFileEvent[] } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const tool = value as Record<string, unknown>;
  const toolName = pickString(tool.name) ?? 'unknown';
  const args = readObject(tool.args) ?? {};
  const timestamp = pickString(tool.timestamp) ?? fallbackTimestamp;
  const outputPreview =
    pickString(tool.resultDisplay) ??
    pickString(
      (
        ((Array.isArray(tool.result) ? tool.result[0] : null) as Record<string, unknown> | null)
          ?.functionResponse as Record<string, unknown> | undefined
      )?.response as unknown,
    ) ??
    null;

  return {
    toolEvent: {
      timestamp,
      toolName,
      operation: inferToolOperation(toolName),
      input: args,
      outputPreview,
      sourceConfidence: toolName === 'run_shell_command' ? 'low' : 'medium',
    },
    fileEvents: inferFileEvents(toolName, args, timestamp, projectPath),
  };
}

function inferToolOperation(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read') || normalized.includes('grep') || normalized.includes('glob')) {
    return 'read';
  }
  if (normalized.includes('write') || normalized.includes('replace')) return 'write';
  if (normalized.includes('edit')) return 'edit';
  if (normalized.includes('shell') || normalized.includes('command')) return 'shell';
  return 'unknown';
}

function inferFileEvents(
  toolName: string,
  args: Record<string, unknown>,
  timestamp: string,
  projectPath: string | null,
): RawFileEvent[] {
  const operation = inferFileOperation(toolName);
  const confidence =
    operation === 'shell_possible' ? 'low' : operation === 'unknown' ? 'medium' : 'high';

  if (operation === 'shell_possible') {
    return [
      {
        path: pickString(args.directory) ?? pickString(args.cwd) ?? projectPath,
        operation,
        toolName,
        timestamp,
        confidence,
        metadata: args,
      },
    ];
  }

  const direct = new Set<string>();
  for (const key of ['absolutePath', 'filePath', 'path', 'include']) {
    const value = pickString(args[key]);
    if (value) direct.add(value);
  }

  for (const key of ['paths', 'files']) {
    const list = args[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'string' && item.length > 0) direct.add(item);
    }
  }

  return [...direct].map((path) => ({
    path,
    operation,
    toolName,
    timestamp,
    confidence,
    metadata: args,
  }));
}

function inferFileOperation(toolName: string): RawFileEvent['operation'] {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read') || normalized.includes('grep') || normalized.includes('glob')) {
    return 'read';
  }
  if (normalized.includes('write') || normalized.includes('replace')) return 'write';
  if (normalized.includes('edit')) return 'edit';
  if (normalized.includes('shell') || normalized.includes('command')) return 'shell_possible';
  return 'unknown';
}

function dedupeFileEvents(rows: RawFileEvent[]): RawFileEvent[] {
  const seen = new Set<string>();
  const deduped: RawFileEvent[] = [];
  for (const row of rows) {
    const key = [row.path ?? '', row.operation, row.toolName ?? '', row.timestamp].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function estimateGeminiCost(
  inputTokens: number,
  outputTokens: number,
  model: string | null,
): number {
  const normalized = model?.toLowerCase() ?? 'gemini-2.5-pro';
  const pricing = GEMINI_PRICING[normalized] ?? GEMINI_PRICING['gemini-2.5-pro'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-3-flash-preview': { input: 0.35, output: 1.05 },
};
