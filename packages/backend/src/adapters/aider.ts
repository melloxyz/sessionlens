import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { Adapter, AdapterCapabilities, Checkpoint, RawMessage, RawSession } from './types.js';
import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

const DEFAULT_HISTORY_FILE = '.aider.chat.history.md';
const DEFAULT_LLM_HISTORY_FILE = '.aider.llm.history';
const AIDER_CAPABILITIES: AdapterCapabilities = {
  messages: 'real',
  tokens: 'partial',
  cost: 'partial',
  model: 'partial',
  provider: 'partial',
  projectPath: 'real',
  duration: 'partial',
  toolCalls: 'unavailable',
  fileReads: 'unavailable',
  fileWrites: 'unavailable',
  multiModel: 'partial',
};

export function createAiderAdapter(): Adapter {
  return {
    cli: 'aider' as CliProvider,

    async detect(): Promise<boolean> {
      return Boolean(findSessionFile());
    },

    async discover(): Promise<string[]> {
      const sessionFile = findSessionFile();
      return sessionFile ? [sessionFile] : [];
    },

    async watchPaths(): Promise<string[]> {
      const sessionFile = findSessionFile();
      return sessionFile ? [sessionFile] : [];
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      if (!existsSync(sessionPath)) return null;
      const stat = await import('node:fs').then((fs) => fs.statSync(sessionPath));
      return {
        lastFileMtime: stat.mtimeMs,
        lastFileSize: stat.size,
        lastSessionId: null,
      };
    },

    async parse(sessionPath: string, _checkpoint: Checkpoint | null): Promise<RawSession[]> {
      if (!existsSync(sessionPath)) return [];

      const projectPath = dirname(sessionPath);
      const llmHistoryFile = findLlmHistoryFile(projectPath);
      const llmHistory =
        llmHistoryFile && existsSync(llmHistoryFile)
          ? parseLlmHistory(readFileSync(llmHistoryFile, 'utf-8'))
          : null;

      if (sessionPath.endsWith(DEFAULT_LLM_HISTORY_FILE)) {
        if (!llmHistory || llmHistory.messages.length === 0) return [];
        return [buildAiderSession(sessionPath, projectPath, llmHistory)];
      }

      const content = readFileSync(sessionPath, 'utf-8');
      const parsed = parseMarkdownHistory(content);
      if (
        parsed.messages.length === 0 &&
        parsed.prompts.length === 0 &&
        parsed.responses.length === 0 &&
        (!llmHistory || llmHistory.messages.length === 0)
      ) {
        return [];
      }

      const merged = mergeHistories(parsed, llmHistory);
      return [buildAiderSession(sessionPath, projectPath, merged)];
    },

    normalize(raw: RawSession): RawSession {
      return raw;
    },

    getCapabilities(): AdapterCapabilities {
      return AIDER_CAPABILITIES;
    },
  };
}

function buildAiderSession(
  sessionPath: string,
  projectPath: string,
  parsed: ReturnType<typeof parseMarkdownHistory>,
): RawSession {
  const startedAt = parsed.startedAt ?? new Date().toISOString();
  const endedAt = parsed.endedAt ?? startedAt;
  const sessionId = `aider-${hashString(sessionPath)}`;
  const hasTokens = parsed.usageEvents.some(
    (event) =>
      event.inputTokens > 0 ||
      event.outputTokens > 0 ||
      event.cacheReadTokens > 0 ||
      event.cacheWriteTokens > 0 ||
      event.reasoningTokens > 0,
  );
  const confidence: SourceConfidence =
    hasTokens || parsed.totalCostUsd != null
      ? 'MEDIUM'
      : parsed.hasStructuredMetadata
        ? 'MEDIUM'
        : 'LOW';

  return {
    sessionId,
    provider: parsed.provider ?? 'openai',
    cli: 'aider' as CliProvider,
    projectPath,
    sourcePath: sessionPath,
    model: parsed.model,
    startedAt,
    endedAt,
    durationMs:
      startedAt && endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : null,
    totalCostUsd: parsed.totalCostUsd,
    sourceConfidence: confidence,
    messages: parsed.messages,
    usageEvents: parsed.usageEvents,
    modelUsage: parsed.modelUsage,
    dataQuality: {
      messages: parsed.messages.length > 0 ? 'real' : 'unavailable',
      tokens: hasTokens ? 'real' : 'unavailable',
      cost: parsed.totalCostUsd != null ? 'estimated' : 'unknown',
      tools: 'unavailable',
      files: 'unavailable',
      model: parsed.model ? 'real' : 'unknown',
      projectPath: 'real',
    },
  };
}

function findSessionFile(): string | null {
  const historyFile = findHistoryFile();
  if (historyFile) return historyFile;

  const llmHistoryFile = findLlmHistoryFile(process.cwd());
  return llmHistoryFile && existsSync(llmHistoryFile) ? llmHistoryFile : null;
}

function findHistoryFile(): string | null {
  const envFile = process.env.AIDER_CHAT_HISTORY_FILE;
  if (envFile && existsSync(envFile)) return resolve(envFile);

  const cwd = process.cwd();
  const local = join(cwd, DEFAULT_HISTORY_FILE);
  if (existsSync(local)) return local;

  const candidates = scanForFiles(cwd, 3, DEFAULT_HISTORY_FILE);
  return candidates[0] ?? null;
}

function findLlmHistoryFile(root: string): string | null {
  const envFile = process.env.AIDER_LLM_HISTORY_FILE;
  if (envFile && existsSync(envFile)) return resolve(envFile);

  const local = join(root, DEFAULT_LLM_HISTORY_FILE);
  if (existsSync(local)) return local;

  const candidates = scanForFiles(root, 3, DEFAULT_LLM_HISTORY_FILE);
  return candidates[0] ?? null;
}

function scanForFiles(root: string, depth: number, targetName: string): string[] {
  if (depth < 0 || !existsSync(root)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isFile() && entry.name === targetName) {
      found.push(full);
      continue;
    }
    if (entry.isDirectory() && depth > 0) {
      found.push(...scanForFiles(full, depth - 1, targetName));
    }
  }
  return found;
}

function parseMarkdownHistory(content: string): {
  messages: RawMessage[];
  prompts: string[];
  responses: string[];
  model: string | null;
  provider: string | null;
  startedAt: string | null;
  endedAt: string | null;
  totalCostUsd: number | null;
  usageEvents: RawSession['usageEvents'];
  modelUsage: RawSession['modelUsage'];
  hasStructuredMetadata: boolean;
} {
  const messages: RawMessage[] = [];
  const prompts: string[] = [];
  const responses: string[] = [];
  const lines = content.split(/\r?\n/);
  const blocks = splitBlocks(lines);

  let model: string | null = null;
  let provider: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let totalCostUsd: number | null = null;
  let hasStructuredMetadata = false;

  for (const block of blocks) {
    const lower = block.toLowerCase();
    if (lower.includes('model:')) {
      model = model ?? extractValue(block, /model:\s*([^\n]+)/i);
      hasStructuredMetadata = true;
    }
    if (lower.includes('provider:')) {
      provider = provider ?? extractValue(block, /provider:\s*([^\n]+)/i);
      hasStructuredMetadata = true;
    }
    if (lower.includes('cost:') || lower.includes('total cost')) {
      const rawCost = extractValue(block, /(?:total cost|cost):\s*([^\n]+)/i);
      if (rawCost) {
        const parsed = Number(rawCost.replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(parsed)) totalCostUsd = parsed;
      }
      hasStructuredMetadata = true;
    }
    if (lower.includes('started') || lower.includes('timestamp')) {
      startedAt = startedAt ?? extractValue(block, /(?:started|timestamp):\s*([^\n]+)/i);
      endedAt = endedAt ?? extractValue(block, /(?:ended|timestamp):\s*([^\n]+)/i);
    }
  }

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const role = detectRole(trimmed);
    if (!role) continue;

    const text = extractMarkdownText(trimmed);
    if (!text) continue;

    messages.push({
      role,
      content: text,
      timestamp: startedAt ?? new Date().toISOString(),
    });

    if (role === 'user') prompts.push(text);
    if (role === 'assistant') responses.push(text);
  }

  return {
    messages,
    prompts,
    responses,
    model,
    provider,
    startedAt,
    endedAt,
    totalCostUsd,
    usageEvents: [],
    modelUsage:
      model && provider
        ? [
            {
              provider,
              model,
              messageCount: messages.length,
              inputTokens: 0,
              outputTokens: 0,
              reasoningTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              toolCallsCount: 0,
              totalCostUsd: totalCostUsd ?? 0,
            },
          ]
        : [],
    hasStructuredMetadata,
  };
}

function parseLlmHistory(content: string): ReturnType<typeof parseMarkdownHistory> {
  const messages: RawMessage[] = [];
  const modelUsage = new Map<string, NonNullable<RawSession['modelUsage']>[number]>();
  const usageEvents: NonNullable<RawSession['usageEvents']> = [];

  let model: string | null = null;
  let provider: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let totalCostUsd = 0;
  let hasStructuredMetadata = false;

  for (const line of content.split(/\r?\n/).filter(Boolean)) {
    let event: Record<string, unknown> | null = null;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!event) continue;

    const timestamp = readString(event.timestamp) ?? new Date().toISOString();
    startedAt = startedAt ?? timestamp;
    endedAt = timestamp;

    const role = normalizeRole(readString(event.role) ?? readString(event.type));
    const text = readString(event.content) ?? readString(event.message) ?? '';
    if (role && text) {
      messages.push({ role, content: text, timestamp });
    }

    provider = readString(event.provider) ?? readString(event.provider_name) ?? provider;
    model = readString(event.model) ?? readString(event.model_name) ?? model;

    const inputTokens = Number(event.input_tokens ?? 0) || 0;
    const outputTokens = Number(event.output_tokens ?? 0) || 0;
    const cacheReadTokens = Number(event.cache_read_tokens ?? 0) || 0;
    const cacheWriteTokens = Number(event.cache_write_tokens ?? 0) || 0;
    const reasoningTokens = Number(event.reasoning_tokens ?? 0) || 0;
    const cost = Number(event.cost ?? event.total_cost ?? 0) || 0;
    if (
      inputTokens > 0 ||
      outputTokens > 0 ||
      cacheReadTokens > 0 ||
      cacheWriteTokens > 0 ||
      reasoningTokens > 0
    ) {
      usageEvents.push({
        timestamp,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        reasoningTokens,
        toolCallsCount: 0,
      });
      hasStructuredMetadata = true;
    }
    totalCostUsd += cost;

    if (provider && model) {
      const key = `${provider}/${model}`;
      const current = modelUsage.get(key) ?? {
        provider,
        model,
        messageCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        toolCallsCount: 0,
        totalCostUsd: 0,
      };
      current.messageCount += role ? 1 : 0;
      current.inputTokens += inputTokens;
      current.outputTokens += outputTokens;
      current.reasoningTokens += reasoningTokens;
      current.cacheReadTokens += cacheReadTokens;
      current.cacheWriteTokens += cacheWriteTokens;
      current.totalCostUsd += cost;
      modelUsage.set(key, current);
    }
  }

  return {
    messages,
    prompts: messages.filter((item) => item.role === 'user').map((item) => item.content),
    responses: messages.filter((item) => item.role === 'assistant').map((item) => item.content),
    model,
    provider,
    startedAt,
    endedAt,
    totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
    usageEvents,
    modelUsage: [...modelUsage.values()],
    hasStructuredMetadata,
  };
}

function mergeHistories(
  markdown: ReturnType<typeof parseMarkdownHistory>,
  llm: ReturnType<typeof parseMarkdownHistory> | null,
): ReturnType<typeof parseMarkdownHistory> {
  if (!llm) return markdown;

  return {
    messages: markdown.messages.length > 0 ? markdown.messages : llm.messages,
    prompts: markdown.prompts.length > 0 ? markdown.prompts : llm.prompts,
    responses: markdown.responses.length > 0 ? markdown.responses : llm.responses,
    model: markdown.model ?? llm.model,
    provider: markdown.provider ?? llm.provider,
    startedAt: markdown.startedAt ?? llm.startedAt,
    endedAt: markdown.endedAt ?? llm.endedAt,
    totalCostUsd: markdown.totalCostUsd ?? llm.totalCostUsd,
    usageEvents: llm.usageEvents.length > 0 ? llm.usageEvents : markdown.usageEvents,
    modelUsage: llm.modelUsage && llm.modelUsage.length > 0 ? llm.modelUsage : markdown.modelUsage,
    hasStructuredMetadata: markdown.hasStructuredMetadata || llm.hasStructuredMetadata,
  };
}

function splitBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line.trim() && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks;
}

function detectRole(block: string): RawMessage['role'] | null {
  if (/^#+\s*user/i.test(block) || /\buser\b/i.test(block.split('\n')[0] ?? '')) return 'user';
  if (
    /^#+\s*(assistant|response|ai)/i.test(block) ||
    /\bassistant\b/i.test(block.split('\n')[0] ?? '')
  ) {
    return 'assistant';
  }
  if (/^#+\s*system/i.test(block)) return 'system';
  return null;
}

function normalizeRole(value: string | null): RawMessage['role'] | null {
  if (!value) return null;
  if (value === 'user' || value === 'assistant' || value === 'system' || value === 'tool') {
    return value;
  }
  return null;
}

function extractMarkdownText(block: string): string {
  const lines = block.split(/\r?\n/).map((line) => line.replace(/^\s*[-*]\s*/, '').trim());
  return lines
    .filter((line) => line && !/^#+\s*(user|assistant|system|response|assistant reply)/i.test(line))
    .join('\n')
    .trim();
}

function extractValue(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}
