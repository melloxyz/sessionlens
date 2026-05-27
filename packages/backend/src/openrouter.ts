import { getDatabase, saveDatabase } from './db/connection.js';

interface OpenRouterModel {
  id?: string;
  name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  };
}

export interface OpenRouterSyncResult {
  synced: number;
  skipped: number;
}

export async function syncOpenRouterPricing(timeoutMs = 8000): Promise<OpenRouterSyncResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
    const payload = (await response.json()) as { data?: OpenRouterModel[] };
    const models = Array.isArray(payload.data) ? payload.data : [];
    const db = getDatabase();
    let synced = 0;
    let skipped = 0;

    const stmt = db.prepare(`
      INSERT INTO models (provider, model_name, input_cost_per_million, output_cost_per_million, cached_input_cost)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider, model_name) DO UPDATE SET
        input_cost_per_million = excluded.input_cost_per_million,
        output_cost_per_million = excluded.output_cost_per_million,
        cached_input_cost = COALESCE(models.cached_input_cost, excluded.cached_input_cost)
    `);

    try {
      for (const model of models) {
        const id = model.id?.trim();
        if (!id) {
          skipped++;
          continue;
        }
        const inputPer1M = Number(model.pricing?.prompt ?? 0) * 1_000_000;
        const outputPer1M = Number(model.pricing?.completion ?? 0) * 1_000_000;
        if (!(inputPer1M > 0 || outputPer1M > 0)) {
          skipped++;
          continue;
        }

        const { provider, modelName } = splitOpenRouterId(id);
        stmt.run([provider, modelName, inputPer1M, outputPer1M, null]);
        if (modelName !== id) stmt.run([provider, id, inputPer1M, outputPer1M, null]);
        synced++;
      }
    } finally {
      stmt.free();
    }

    saveDatabase();
    return { synced, skipped };
  } finally {
    clearTimeout(timer);
  }
}

function splitOpenRouterId(id: string): { provider: string; modelName: string } {
  const parts = id.split('/');
  if (parts.length < 2) return { provider: 'openrouter', modelName: id.toLowerCase() };
  return { provider: parts[0].toLowerCase(), modelName: parts.slice(1).join('/').toLowerCase() };
}
