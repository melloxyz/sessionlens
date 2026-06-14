import { getDatabase } from './db/connection.js';
import type { RawModelUsage, RawSession } from './adapters/types.js';
import { normalizeProvider, normalizeModel } from './db/normalize.js';

export type CostSource = 'actual' | 'estimated' | 'unknown';

export interface CostResolution {
  totalCostUsd: number | null;
  costSource: CostSource;
  modelUsage: RawModelUsage[];
}

interface PricingRow {
  provider: string;
  modelName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCost: number | null;
}

let _pricingCache: Map<string, PricingRow | null> | null = null;

export function initPricingCache(): void {
  _pricingCache = new Map();
}

export function clearPricingCache(): void {
  _pricingCache = null;
}

const FALLBACK_PRICING: Record<string, Omit<PricingRow, 'provider' | 'modelName'>> = {
  // OpenAI / Codex
  'gpt-5.5': { inputCostPerMillion: 2.5, outputCostPerMillion: 20, cachedInputCost: 1.25 },
  'gpt-5.4': { inputCostPerMillion: 1.75, outputCostPerMillion: 14, cachedInputCost: 0.875 },
  'gpt-5.4-mini': { inputCostPerMillion: 0.15, outputCostPerMillion: 0.6, cachedInputCost: 0.075 },
  'gpt-5.3-codex': { inputCostPerMillion: 3, outputCostPerMillion: 15, cachedInputCost: null },
  'gpt-4.1': { inputCostPerMillion: 2, outputCostPerMillion: 8, cachedInputCost: 0.5 },
  'gpt-4.1-mini': { inputCostPerMillion: 0.4, outputCostPerMillion: 1.6, cachedInputCost: 0.1 },
  'gpt-4o': { inputCostPerMillion: 2.5, outputCostPerMillion: 10, cachedInputCost: 1.25 },
  // Anthropic Claude — new versioning (claude-<family>-<major>-<minor>)
  'claude-sonnet-4-6': { inputCostPerMillion: 3, outputCostPerMillion: 15, cachedInputCost: 0.3 },
  'claude-opus-4-8': { inputCostPerMillion: 15, outputCostPerMillion: 75, cachedInputCost: 1.5 },
  'claude-haiku-4-5': { inputCostPerMillion: 0.8, outputCostPerMillion: 4, cachedInputCost: 0.08 },
  // Anthropic Claude — legacy date-stamp versioning
  'claude-sonnet-4-20250514': {
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
    cachedInputCost: 0.3,
  },
  'claude-opus-4-20250514': {
    inputCostPerMillion: 15,
    outputCostPerMillion: 75,
    cachedInputCost: 1.5,
  },
  'claude-3-7-sonnet': { inputCostPerMillion: 3, outputCostPerMillion: 15, cachedInputCost: 0.3 },
  'claude-3-5-sonnet': { inputCostPerMillion: 3, outputCostPerMillion: 15, cachedInputCost: 0.3 },
  'claude-3-5-haiku': { inputCostPerMillion: 0.8, outputCostPerMillion: 4, cachedInputCost: 0.08 },
  'claude-3-opus': { inputCostPerMillion: 15, outputCostPerMillion: 75, cachedInputCost: 1.5 },
  'claude-3-haiku': {
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 1.25,
    cachedInputCost: 0.03,
  },
  // Google Gemini
  'gemini-3.1-pro-preview': {
    inputCostPerMillion: 2,
    outputCostPerMillion: 12,
    cachedInputCost: null,
  },
  'gemini-2.5-pro': { inputCostPerMillion: 1.25, outputCostPerMillion: 10, cachedInputCost: null },
  'gemini-2.5-flash': {
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCost: null,
  },
  'gemini-2.0-flash': {
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    cachedInputCost: null,
  },
  // Others
  'qwen-plus': { inputCostPerMillion: 0.4, outputCostPerMillion: 1.2, cachedInputCost: null },
  'deepseek-v4-pro': { inputCostPerMillion: 2.5, outputCostPerMillion: 10, cachedInputCost: null },
  'deepseek-chat': { inputCostPerMillion: 0.27, outputCostPerMillion: 1.1, cachedInputCost: 0.07 },
  'deepseek-reasoner': {
    inputCostPerMillion: 0.55,
    outputCostPerMillion: 2.19,
    cachedInputCost: 0.14,
  },
};

export function resolveSessionCost(raw: RawSession): CostResolution {
  const rows = raw.modelUsage?.length ? raw.modelUsage : aggregateUsage(raw);
  const actualTotal = normalizeCost(raw.totalCostUsd) ?? sumActualCost(rows);
  if (actualTotal != null && actualTotal > 0) {
    // Respect the adapter's declared cost quality when present; only fall back to
    // 'actual' for adapters that don't declare dataQuality (backward-compatible).
    const declaredQuality = raw.dataQuality?.cost;
    const costSource: CostSource =
      declaredQuality === 'estimated'
        ? 'estimated'
        : declaredQuality === 'unknown'
          ? 'unknown'
          : 'actual';
    return {
      totalCostUsd: actualTotal,
      costSource,
      modelUsage: distributeActualCost(rows, actualTotal),
    };
  }

  const estimatedRows = rows.map((row) => ({ ...row, totalCostUsd: estimateRowCost(row) ?? 0 }));
  const estimatedTotal = estimatedRows.reduce((sum, row) => sum + row.totalCostUsd, 0);
  if (estimatedTotal > 0)
    return { totalCostUsd: estimatedTotal, costSource: 'estimated', modelUsage: estimatedRows };

  return { totalCostUsd: null, costSource: 'unknown', modelUsage: rows };
}

function aggregateUsage(raw: RawSession): RawModelUsage[] {
  const usage = raw.usageEvents.reduce(
    (sum, event) => ({
      inputTokens: sum.inputTokens + (event.inputTokens ?? 0),
      outputTokens: sum.outputTokens + (event.outputTokens ?? 0),
      reasoningTokens: sum.reasoningTokens + (event.reasoningTokens ?? 0),
      cacheReadTokens: sum.cacheReadTokens + (event.cacheReadTokens ?? 0),
      cacheWriteTokens: sum.cacheWriteTokens + (event.cacheWriteTokens ?? 0),
      toolCallsCount: sum.toolCallsCount + (event.toolCallsCount ?? 0),
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCallsCount: 0,
    },
  );

  if (
    usage.inputTokens === 0 &&
    usage.outputTokens === 0 &&
    usage.reasoningTokens === 0 &&
    usage.cacheReadTokens === 0 &&
    usage.cacheWriteTokens === 0 &&
    usage.toolCallsCount === 0
  )
    return [];

  return [
    {
      provider: raw.provider || 'unknown',
      model: raw.model || 'unknown',
      messageCount: raw.messages.length,
      totalCostUsd: normalizeCost(raw.totalCostUsd) ?? 0,
      ...usage,
    },
  ];
}

function sumActualCost(rows: RawModelUsage[]): number | null {
  const total = rows.reduce((sum, row) => sum + (normalizeCost(row.totalCostUsd) ?? 0), 0);
  return total > 0 ? total : null;
}

function distributeActualCost(rows: RawModelUsage[], totalCost: number): RawModelUsage[] {
  if (rows.length === 0) return rows;
  const rowTotal = sumActualCost(rows);
  if (rowTotal != null)
    return rows.map((row) => ({ ...row, totalCostUsd: normalizeCost(row.totalCostUsd) ?? 0 }));

  const tokenWeights = rows.map((row) => billableTokens(row));
  const totalWeight = tokenWeights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0)
    return rows.map((row, index) => ({ ...row, totalCostUsd: index === 0 ? totalCost : 0 }));
  return rows.map((row, index) => ({
    ...row,
    totalCostUsd: totalCost * (tokenWeights[index] / totalWeight),
  }));
}

function estimateRowCost(row: RawModelUsage): number | null {
  const pricing = findPricing(row.provider, row.model);
  if (!pricing) return null;
  const input = Math.max(0, row.inputTokens + row.cacheWriteTokens);
  const cachedRead = Math.max(0, row.cacheReadTokens);
  const output = Math.max(0, row.outputTokens + row.reasoningTokens);
  const inputCost = (input / 1_000_000) * pricing.inputCostPerMillion;
  const cachedCost =
    (cachedRead / 1_000_000) * (pricing.cachedInputCost ?? pricing.inputCostPerMillion);
  const outputCost = (output / 1_000_000) * pricing.outputCostPerMillion;
  const total = inputCost + cachedCost + outputCost;
  return total > 0 ? total : null;
}

function findPricing(provider: string, model: string): PricingRow | null {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedModel = normalizeModel(model);
  if (normalizedModel == null) return null;

  const cacheKey = `${normalizedProvider}:${normalizedModel}`;
  if (_pricingCache !== null) {
    if (_pricingCache.has(cacheKey)) return _pricingCache.get(cacheKey)!;
    const result = lookupPricingFromDb(normalizedProvider, normalizedModel);
    _pricingCache.set(cacheKey, result);
    return result;
  }

  return lookupPricingFromDb(normalizedProvider, normalizedModel);
}

function lookupPricingFromDb(
  normalizedProvider: string,
  normalizedModel: string,
): PricingRow | null {
  const db = getDatabase();
  const exact = db.exec(
    `SELECT provider, model_name, input_cost_per_million, output_cost_per_million, cached_input_cost
     FROM models WHERE LOWER(provider) = ? AND LOWER(model_name) = ? LIMIT 1`,
    [normalizedProvider, normalizedModel],
  );
  const exactRow = mapPricing(exact);
  if (exactRow) return exactRow;

  const modelOnly = db.exec(
    `SELECT provider, model_name, input_cost_per_million, output_cost_per_million, cached_input_cost
     FROM models WHERE LOWER(model_name) = ? LIMIT 1`,
    [normalizedModel],
  );
  const modelOnlyRow = mapPricing(modelOnly);
  if (modelOnlyRow) return modelOnlyRow;

  const fallbackKey = Object.keys(FALLBACK_PRICING).find(
    (key) => normalizedModel === key || normalizedModel.includes(key),
  );
  if (!fallbackKey) return null;
  return {
    provider: normalizedProvider,
    modelName: normalizedModel,
    ...FALLBACK_PRICING[fallbackKey],
  };
}

function mapPricing(result: ReturnType<ReturnType<typeof getDatabase>['exec']>): PricingRow | null {
  const row = result[0]?.values?.[0];
  if (!row) return null;
  return {
    provider: String(row[0]),
    modelName: String(row[1]),
    inputCostPerMillion: Number(row[2]) || 0,
    outputCostPerMillion: Number(row[3]) || 0,
    cachedInputCost: row[4] == null ? null : Number(row[4]),
  };
}

function normalizeCost(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  return value;
}

function billableTokens(row: RawModelUsage): number {
  return (
    row.inputTokens +
    row.outputTokens +
    row.reasoningTokens +
    row.cacheReadTokens +
    row.cacheWriteTokens
  );
}
