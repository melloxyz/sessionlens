import { existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
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
} from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

const CLAUDE_HOME = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_HOME, 'projects');
const CLAUDE_CAPABILITIES: AdapterCapabilities = {
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
  multiModel: 'partial',
};

export function createClaudeAdapter(): Adapter {
  return {
    cli: 'claude' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(PROJECTS_DIR);
    },

    async discover(): Promise<string[]> {
      const paths: string[] = [];
      if (!existsSync(PROJECTS_DIR)) return paths;

      const projectDirs = await readdir(PROJECTS_DIR, { withFileTypes: true });
      for (const dir of projectDirs) {
        if (!dir.isDirectory()) continue;
        const projPath = join(PROJECTS_DIR, dir.name);
        const files = await readdir(projPath);
        for (const f of files) {
          if (f.endsWith('.jsonl')) {
            paths.push(join(projPath, f));
          }
        }
      }
      return paths;
    },

    async watchPaths(): Promise<string[]> {
      return [PROJECTS_DIR];
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

      const events: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // skip malformed lines
        }
      }

      return buildClaudeSessions(events, sessionPath);
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },

    getCapabilities(): AdapterCapabilities {
      return CLAUDE_CAPABILITIES;
    },
  };
}

function buildClaudeSessions(events: Record<string, unknown>[], filePath: string): RawSession[] {
  const sessionMap = new Map<
    string,
    {
      messages: RawMessage[];
      firstTs: string;
      lastTs: string;
      cwd: string | null;
      modelTokens: Map<
        string,
        {
          inputTokens: number;
          outputTokens: number;
          cacheReadTokens: number;
          cacheWriteTokens: number;
          reasoningTokens: number;
          toolCallsCount: number;
          messageCount: number;
        }
      >;
      toolEvents: RawToolEvent[];
      fileEvents: RawFileEvent[];
    }
  >();

  for (const evt of events) {
    const type = evt.type as string;
    const sessionId = evt.sessionId as string | undefined;
    const ts = (evt.timestamp as string) ?? '';

    if (!sessionId) continue;

    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        messages: [],
        firstTs: ts,
        lastTs: ts,
        cwd: null,
        modelTokens: new Map(),
        toolEvents: [],
        fileEvents: [],
      });
    }
    const sess = sessionMap.get(sessionId)!;

    if (ts && (sess.firstTs === '' || ts < sess.firstTs)) sess.firstTs = ts;
    if (ts && ts > sess.lastTs) sess.lastTs = ts;
    if (typeof evt.cwd === 'string') sess.cwd = evt.cwd;

    switch (type) {
      case 'user': {
        if (evt.isMeta === true) break;
        const message = evt.message as Record<string, unknown> | undefined;
        if (message?.role === 'user') {
          const content = extractTextBlocks(message.content);
          if (content && !content.includes('<command-name>')) {
            sess.messages.push({ role: 'user', content, timestamp: ts });
          }
        }
        break;
      }

      case 'assistant': {
        const message = evt.message as Record<string, unknown> | undefined;
        if (!message) break;

        const text = extractTextBlocks(message.content);
        if (text) {
          sess.messages.push({ role: 'assistant', content: text, timestamp: ts });
        }

        const usage = message.usage as Record<string, unknown> | undefined;
        if (usage) {
          const modelName = (message.model as string) || 'unknown';
          const acc = sess.modelTokens.get(modelName) ?? {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            reasoningTokens: 0,
            toolCallsCount: 0,
            messageCount: 0,
          };
          acc.inputTokens += Number(usage.input_tokens) || 0;
          acc.outputTokens += Number(usage.output_tokens) || 0;
          acc.cacheReadTokens += Number(usage.cache_read_input_tokens) || 0;
          acc.cacheWriteTokens += Number(usage.cache_creation_input_tokens) || 0;
          acc.reasoningTokens += Number(usage.reasoning_tokens) || 0;
          acc.messageCount += 1;
          sess.modelTokens.set(modelName, acc);
        }

        const blocks = Array.isArray(message.content) ? message.content : [];
        for (const block of blocks) {
          if (!block || typeof block !== 'object') continue;
          const normalized = normalizeClaudeToolBlock(block as Record<string, unknown>, ts);
          if (normalized) {
            sess.toolEvents.push(normalized.toolEvent);
            sess.fileEvents.push(...normalized.fileEvents);
          }
        }
        break;
      }

      case 'tool_use': {
        const normalized = normalizeClaudeToolBlock(evt, ts);
        if (normalized) {
          sess.toolEvents.push(normalized.toolEvent);
          sess.fileEvents.push(...normalized.fileEvents);
        }
        break;
      }

      case 'result': {
        const result = evt.result as string | undefined;
        if (result) {
          sess.messages.push({ role: 'tool', content: result, timestamp: ts });
        }
        break;
      }
    }
  }

  const sessions: RawSession[] = [];
  for (const [sessionId, data] of sessionMap) {
    // Build per-model usage from accumulated token data
    const modelUsage: RawModelUsage[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalReasoning = 0;

    for (const [model, tokens] of data.modelTokens) {
      modelUsage.push({
        provider: 'anthropic',
        model,
        messageCount: tokens.messageCount,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        reasoningTokens: tokens.reasoningTokens,
        cacheReadTokens: tokens.cacheReadTokens,
        cacheWriteTokens: tokens.cacheWriteTokens,
        toolCallsCount: 0,
        totalCostUsd: 0,
      });
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;
      totalCacheRead += tokens.cacheReadTokens;
      totalCacheWrite += tokens.cacheWriteTokens;
      totalReasoning += tokens.reasoningTokens;
    }

    const hasTokenData =
      totalInputTokens + totalOutputTokens + totalCacheRead + totalCacheWrite + totalReasoning > 0;

    // Primary model: the one with the most output tokens (most substantive responses)
    const primaryModel =
      modelUsage.length > 0
        ? modelUsage.reduce((a, b) => (b.outputTokens > a.outputTokens ? b : a)).model
        : null;

    const confidence: SourceConfidence =
      hasTokenData || data.toolEvents.length > 0
        ? 'HIGH'
        : data.messages.length > 0
          ? 'MEDIUM'
          : 'LOW';

    const startTime = data.firstTs || new Date().toISOString();
    const endTime = data.lastTs || startTime;
    const durationMs =
      data.firstTs && data.lastTs
        ? new Date(data.lastTs).getTime() - new Date(data.firstTs).getTime()
        : null;

    if (data.messages.length === 0 && !hasTokenData && data.toolEvents.length === 0) {
      continue;
    }

    sessions.push({
      sessionId,
      provider: 'anthropic',
      cli: 'claude',
      projectPath: data.cwd,
      sourcePath: filePath,
      model: primaryModel,
      startedAt: startTime,
      endedAt: endTime,
      durationMs,
      totalCostUsd: null,
      sourceConfidence: confidence,
      messages: data.messages,
      usageEvents: hasTokenData
        ? [
            {
              timestamp: startTime,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              cacheReadTokens: totalCacheRead,
              cacheWriteTokens: totalCacheWrite,
              reasoningTokens: totalReasoning,
              toolCallsCount: data.toolEvents.length,
            },
          ]
        : [],
      modelUsage: modelUsage.length > 0 ? modelUsage : undefined,
      toolEvents: data.toolEvents,
      fileEvents: data.fileEvents,
      dataQuality: {
        messages: data.messages.length > 0 ? 'real' : 'unavailable',
        tokens: hasTokenData ? 'real' : 'unavailable',
        cost: hasTokenData ? 'estimated' : 'unknown',
        tools: data.toolEvents.length > 0 ? 'real' : 'unavailable',
        files: data.fileEvents.length > 0 ? 'heuristic' : 'unavailable',
        model: primaryModel ? 'real' : 'unknown',
        projectPath: data.cwd ? 'real' : 'unknown',
      },
    });
  }

  return sessions;
}

function extractTextBlocks(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((item: Record<string, unknown>) => item.type === 'text')
    .map((item: Record<string, unknown>) => String(item.text ?? ''))
    .join('\n');
}

function normalizeClaudeToolBlock(
  block: Record<string, unknown>,
  timestamp: string,
): { toolEvent: RawToolEvent; fileEvents: RawFileEvent[] } | null {
  const type = String(block.type ?? '');
  if (type !== 'tool_use') return null;

  const toolName = String(block.name ?? block.tool_name ?? 'tool_use');
  const input =
    block.input && typeof block.input === 'object' && !Array.isArray(block.input)
      ? (block.input as Record<string, unknown>)
      : {};
  const operation = inferToolOperation(toolName);
  const confidence = toolName === 'Bash' ? 'low' : 'medium';

  return {
    toolEvent: {
      timestamp,
      toolName,
      operation,
      input,
      outputPreview: null,
      sourceConfidence: confidence,
    },
    fileEvents: inferFileEvents(toolName, input, timestamp, confidence),
  };
}

function inferToolOperation(toolName: string): string {
  switch (toolName.toLowerCase()) {
    case 'read':
      return 'read';
    case 'write':
      return 'write';
    case 'edit':
    case 'multiedit':
      return 'edit';
    case 'bash':
      return 'shell';
    default:
      return 'unknown';
  }
}

function inferFileEvents(
  toolName: string,
  input: Record<string, unknown>,
  timestamp: string,
  confidence: RawToolEvent['sourceConfidence'],
): RawFileEvent[] {
  const candidates = [
    readString(input.file_path),
    readString(input.path),
    readString(input.absolute_path),
  ].filter((value): value is string => Boolean(value));
  const operation =
    toolName === 'Read'
      ? 'read'
      : toolName === 'Write'
        ? 'write'
        : toolName === 'Edit' || toolName === 'MultiEdit'
          ? 'edit'
          : toolName === 'Bash'
            ? 'shell_possible'
            : 'unknown';

  if (candidates.length === 0 && operation !== 'shell_possible') return [];

  if (operation === 'shell_possible') {
    return [
      {
        path: readString(input.cwd) ?? readString(input.directory) ?? null,
        operation,
        toolName,
        timestamp,
        confidence,
        metadata: input,
      },
    ];
  }

  return candidates.map((path) => ({
    path,
    operation,
    toolName,
    timestamp,
    confidence,
    metadata: input,
  }));
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
