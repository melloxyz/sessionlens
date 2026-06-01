import type { AdapterCapabilities, RawSession, SessionDataQuality } from '../adapters/types.js';

export function countToolCalls(raw: RawSession): number {
  if ((raw.toolEvents?.length ?? 0) > 0) {
    return raw.toolEvents!.length;
  }

  const usageCount = raw.usageEvents.reduce((sum, event) => sum + (event.toolCallsCount ?? 0), 0);
  if (usageCount > 0) {
    return usageCount;
  }

  return (raw.modelUsage ?? []).reduce((sum, event) => sum + (event.toolCallsCount ?? 0), 0);
}

export function buildSessionDataQuality(
  raw: RawSession,
  costSource: SessionDataQuality['cost'],
): SessionDataQuality {
  const fallback: SessionDataQuality = {
    messages: raw.messages.length > 0 ? 'real' : 'unavailable',
    tokens: hasRealTokens(raw) ? 'real' : 'unavailable',
    cost: costSource,
    tools: countToolCalls(raw) > 0 ? 'real' : 'unavailable',
    files: inferFilesQuality(raw),
    model: raw.model ? 'real' : 'unknown',
    projectPath: raw.projectPath ? 'real' : 'unknown',
  };

  return {
    ...fallback,
    ...(raw.dataQuality ?? {}),
    cost: raw.dataQuality?.cost ?? costSource,
  };
}

export function summarizeQuality(rows: SessionDataQuality[]): SessionDataQuality {
  if (rows.length === 0) {
    return {
      messages: 'unavailable',
      tokens: 'unavailable',
      cost: 'unknown',
      tools: 'unavailable',
      files: 'unavailable',
      model: 'unknown',
      projectPath: 'unknown',
    };
  }

  return {
    messages: pickHighest(
      rows.map((row) => row.messages),
      ['real', 'partial', 'unavailable'],
    ),
    tokens: pickHighest(
      rows.map((row) => row.tokens),
      ['real', 'estimated', 'unavailable'],
    ),
    cost: pickHighest(
      rows.map((row) => row.cost),
      ['actual', 'estimated', 'unknown'],
    ),
    tools: pickHighest(
      rows.map((row) => row.tools),
      ['real', 'partial', 'unavailable'],
    ),
    files: pickHighest(
      rows.map((row) => row.files),
      ['real', 'heuristic', 'unavailable'],
    ),
    model: pickHighest(
      rows.map((row) => row.model),
      ['real', 'inferred', 'unknown'],
    ),
    projectPath: pickHighest(
      rows.map((row) => row.projectPath),
      ['real', 'inferred', 'unknown'],
    ),
  };
}

export function capabilityScore(capabilities: AdapterCapabilities): number {
  const values = Object.values(capabilities);
  if (values.length === 0) return 0;

  const total = values.reduce((sum, capability) => sum + capabilityValue(capability), 0);
  return Math.round((total / (values.length * 4)) * 100);
}

function capabilityValue(capability: AdapterCapabilities[keyof AdapterCapabilities]): number {
  switch (capability) {
    case 'real':
      return 4;
    case 'estimated':
      return 3;
    case 'partial':
      return 2;
    case 'unknown':
      return 1;
    case 'unavailable':
    default:
      return 0;
  }
}

function hasRealTokens(raw: RawSession): boolean {
  return raw.usageEvents.some(
    (event) =>
      event.inputTokens > 0 ||
      event.outputTokens > 0 ||
      event.reasoningTokens > 0 ||
      event.cacheReadTokens > 0 ||
      event.cacheWriteTokens > 0,
  );
}

function inferFilesQuality(raw: RawSession): SessionDataQuality['files'] {
  const fileEvents = raw.fileEvents ?? [];
  if (fileEvents.length === 0) return 'unavailable';
  if (fileEvents.some((event) => event.confidence === 'high' || event.confidence === 'medium')) {
    return 'real';
  }
  return 'heuristic';
}

function pickHighest<T extends string>(values: T[], order: readonly T[]): T {
  for (const item of order) {
    if (values.includes(item)) return item;
  }
  return order[order.length - 1];
}
