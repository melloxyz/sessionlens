import type { RawFileEvent, RawModelUsage } from './types.js';

export function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function updateModelUsage(map: Map<string, RawModelUsage>, row: RawModelUsage): void {
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

export function dedupeFileEvents(rows: RawFileEvent[]): RawFileEvent[] {
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
