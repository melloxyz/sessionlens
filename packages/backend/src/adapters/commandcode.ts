import { existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import type {
  Adapter,
  Checkpoint,
  RawSession,
  RawMessage,
  RawUsageEvent,
  RawModelUsage,
} from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

const COMMANDCODE_HOME = join(homedir(), '.commandcode');
const PROJECTS_DIR = join(COMMANDCODE_HOME, 'projects');

interface CommandCodeEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  parentId: string;
  role: 'user' | 'assistant' | 'tool';
  content: CommandCodeContentBlock[];
  gitBranch?: string;
  metadata: {
    timestamp: string;
    source: string;
    messageId?: string;
    isAutomated?: boolean;
    version: number;
  };
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  tokens_used?: number;
}

type CommandCodeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      output: { type: string; value?: string; text?: string };
    };

interface MetaJson {
  model?: string;
  title?: string;
}

function parseProvider(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  const slash = raw.indexOf('/');
  return slash > 0 ? raw.slice(0, slash) : raw;
}

function parseModel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slash = raw.indexOf('/');
  return slash > 0 ? raw.slice(slash + 1) : raw;
}

function decodeProjectPath(dirName: string): string | null {
  if (!dirName || dirName.length < 2) return null;
  const drive = dirName[0].toUpperCase();
  const rest = dirName.slice(1).replace(/-/g, '\\');
  return `${drive}:${rest}`;
}

async function readMeta(sessionPath: string): Promise<MetaJson> {
  const metaPath = sessionPath.replace(/\.jsonl$/, '.meta.json');
  if (!existsSync(metaPath)) return {};
  try {
    const raw = await readFile(metaPath, 'utf-8');
    return JSON.parse(raw) as MetaJson;
  } catch {
    return {};
  }
}

async function walkJsonlFiles(dir: string, depth: number): Promise<string[]> {
  if (depth <= 0 || !existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkJsonlFiles(full, depth - 1)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.jsonl') &&
      !entry.name.endsWith('.checkpoints.jsonl')
    ) {
      results.push(full);
    }
  }
  return results;
}

function buildSession(
  events: CommandCodeEvent[],
  meta: MetaJson,
  projectPath: string | null,
): RawSession[] {
  const groups = new Map<string, CommandCodeEvent[]>();
  for (const evt of events) {
    const sid = evt.sessionId || 'unknown';
    const list = groups.get(sid);
    if (list) list.push(evt);
    else groups.set(sid, [evt]);
  }

  const sessions: RawSession[] = [];
  for (const [sessionId, group] of groups) {
    group.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const messages: RawMessage[] = [];
    const usageEvents: RawUsageEvent[] = [];
    let toolCallCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalReasoningTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheWriteTokens = 0;

    for (const evt of group) {
      const tokens = extractTokens(evt);
      if (tokens) {
        usageEvents.push(tokens);
        totalInputTokens += tokens.inputTokens;
        totalOutputTokens += tokens.outputTokens;
        totalReasoningTokens += tokens.reasoningTokens;
        totalCacheReadTokens += tokens.cacheReadTokens;
        totalCacheWriteTokens += tokens.cacheWriteTokens;
        toolCallCount += tokens.toolCallsCount;
      }

      const msgContent = extractMessageContent(evt);
      if (msgContent) {
        messages.push({
          role: evt.role,
          content: msgContent,
          timestamp: evt.timestamp,
        });
      }

      if (evt.role === 'tool') {
        const toolMessages = extractToolResults(evt);
        for (const tm of toolMessages) {
          messages.push(tm);
        }
      }

      const tcCount = countToolCalls(evt);
      if (tcCount > 0) {
        toolCallCount += tcCount;
      }
    }

    const model = parseModel(meta.model);
    const provider = parseProvider(meta.model);

    const firstTs = group[0]?.timestamp ?? '';
    const lastTs = group[group.length - 1]?.timestamp ?? '';
    const durationMs =
      firstTs && lastTs ? new Date(lastTs).getTime() - new Date(firstTs).getTime() : null;

    const hasTokens =
      totalInputTokens +
        totalOutputTokens +
        totalReasoningTokens +
        totalCacheReadTokens +
        totalCacheWriteTokens >
      0;
    const confidence: SourceConfidence = hasTokens
      ? 'HIGH'
      : messages.length > 0
        ? 'MEDIUM'
        : 'LOW';

    const modelUsage: RawModelUsage[] =
      hasTokens || messages.length > 0
        ? [
            {
              provider,
              model: model ?? 'unknown',
              messageCount: messages.length,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              reasoningTokens: totalReasoningTokens,
              cacheReadTokens: totalCacheReadTokens,
              cacheWriteTokens: totalCacheWriteTokens,
              toolCallsCount: toolCallCount,
              totalCostUsd: 0,
            },
          ]
        : [];

    sessions.push({
      sessionId,
      provider,
      cli: 'commandcode' as CliProvider,
      projectPath,
      sourcePath: undefined,
      model,
      startedAt: firstTs || new Date().toISOString(),
      endedAt: lastTs || null,
      durationMs,
      totalCostUsd: null,
      sourceConfidence: confidence,
      messages,
      usageEvents,
      modelUsage,
    });
  }

  return sessions;
}

function extractTokens(evt: CommandCodeEvent): RawUsageEvent | null {
  const input = evt.input_tokens ?? 0;
  const output = evt.output_tokens ?? 0;
  const reasoning = evt.reasoning_tokens ?? 0;
  const cacheRead = evt.cache_read_tokens ?? 0;
  const cacheWrite = evt.cache_write_tokens ?? 0;

  if (input === 0 && output === 0 && reasoning === 0 && cacheRead === 0 && cacheWrite === 0) {
    return null;
  }

  return {
    timestamp: evt.timestamp,
    inputTokens: input,
    outputTokens: output,
    reasoningTokens: reasoning,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    toolCallsCount: 0,
  };
}

function extractMessageContent(evt: CommandCodeEvent): string | null {
  if (!evt.content || evt.content.length === 0) return null;

  const parts: string[] = [];
  for (const block of evt.content) {
    if (block.type === 'text' || block.type === 'reasoning') {
      if (block.text) parts.push(block.text);
    }
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

function countToolCalls(evt: CommandCodeEvent): number {
  if (!evt.content) return 0;
  let count = 0;
  for (const block of evt.content) {
    if (block.type === 'tool-call') count++;
  }
  return count;
}

function extractToolResults(evt: CommandCodeEvent): RawMessage[] {
  if (!evt.content) return [];
  const results: RawMessage[] = [];
  for (const block of evt.content) {
    if (block.type === 'tool-result') {
      const output = block.output;
      const text = output?.value ?? output?.text ?? JSON.stringify(output);
      results.push({
        role: 'tool',
        content: text,
        timestamp: evt.timestamp,
      });
    }
  }
  return results;
}

export function createCommandCodeAdapter(): Adapter {
  return {
    cli: 'commandcode' as CliProvider,

    async detect(): Promise<boolean> {
      return existsSync(PROJECTS_DIR);
    },

    async discover(): Promise<string[]> {
      return walkJsonlFiles(PROJECTS_DIR, 3);
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

    async parse(sessionPath: string, _checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];

      const meta = await readMeta(sessionPath);

      const parentDir = basename(dirname(sessionPath));
      const projectPath = decodeProjectPath(parentDir);

      const raw = await readFile(sessionPath, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return [];

      const events: CommandCodeEvent[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as CommandCodeEvent);
        } catch {
          // skip malformed
        }
      }

      return buildSession(events, meta, projectPath);
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },
  };
}
