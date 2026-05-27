import { getDatabase, saveDatabase } from './connection.js';

interface ModelSeed {
  provider: string;
  modelName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCost: number | null;
}

const PRICING: ModelSeed[] = [
  // OpenAI
  {
    provider: 'openai',
    modelName: 'gpt-5.4',
    inputCostPerMillion: 1.75,
    outputCostPerMillion: 14.0,
    cachedInputCost: 0.875,
  },
  {
    provider: 'openai',
    modelName: 'gpt-5.4-mini',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCost: 0.075,
  },
  {
    provider: 'openai',
    modelName: 'gpt-5.5',
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 20.0,
    cachedInputCost: 1.25,
  },
  {
    provider: 'openai',
    modelName: 'gpt-5.3-codex',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCost: null,
  },
  {
    provider: 'openai',
    modelName: 'gpt-4o',
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
    cachedInputCost: 1.25,
  },
  {
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCost: 0.075,
  },
  {
    provider: 'openai',
    modelName: 'gpt-4.1',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    cachedInputCost: 0.5,
  },
  {
    provider: 'openai',
    modelName: 'gpt-4.1-mini',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.6,
    cachedInputCost: 0.1,
  },
  {
    provider: 'openai',
    modelName: 'gpt-4.1-nano',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    cachedInputCost: 0.025,
  },
  {
    provider: 'openai',
    modelName: 'o3',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 40.0,
    cachedInputCost: 2.5,
  },
  {
    provider: 'openai',
    modelName: 'o4-mini',
    inputCostPerMillion: 1.1,
    outputCostPerMillion: 4.4,
    cachedInputCost: 0.275,
  },

  // Anthropic
  {
    provider: 'anthropic',
    modelName: 'claude-opus-4-20250514',
    inputCostPerMillion: 15.0,
    outputCostPerMillion: 75.0,
    cachedInputCost: 1.5,
  },
  {
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-20250514',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCost: 0.3,
  },
  {
    provider: 'anthropic',
    modelName: 'claude-3-5-haiku-20241022',
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4.0,
    cachedInputCost: 0.08,
  },
  {
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    cachedInputCost: 0.3,
  },
  {
    provider: 'anthropic',
    modelName: 'claude-3-5-opus-20241022',
    inputCostPerMillion: 15.0,
    outputCostPerMillion: 75.0,
    cachedInputCost: 1.5,
  },

  // Google
  {
    provider: 'google',
    modelName: 'gemini-2.5-pro',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 10.0,
    cachedInputCost: null,
  },
  {
    provider: 'google',
    modelName: 'gemini-3.1-pro-preview',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 12.0,
    cachedInputCost: null,
  },
  {
    provider: 'google',
    modelName: 'gemini-2.5-flash',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    cachedInputCost: null,
  },
  {
    provider: 'google',
    modelName: 'gemini-2.0-flash',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    cachedInputCost: null,
  },

  // Qwen
  {
    provider: 'qwen',
    modelName: 'qwen-plus',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.2,
    cachedInputCost: null,
  },
  {
    provider: 'qwen',
    modelName: 'qwen-max',
    inputCostPerMillion: 1.6,
    outputCostPerMillion: 6.4,
    cachedInputCost: null,
  },

  // DeepSeek
  {
    provider: 'deepseek',
    modelName: 'deepseek-chat',
    inputCostPerMillion: 0.27,
    outputCostPerMillion: 1.1,
    cachedInputCost: 0.07,
  },
  {
    provider: 'deepseek',
    modelName: 'deepseek-reasoner',
    inputCostPerMillion: 0.55,
    outputCostPerMillion: 2.19,
    cachedInputCost: 0.14,
  },
];

export function seedModels(): void {
  const db = getDatabase();

  const existing = db.exec(`SELECT COUNT(*) as cnt FROM models`);
  const count = existing[0]?.values[0]?.[0] as number | undefined;
  if (count && count > 0) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO models (provider, model_name, input_cost_per_million, output_cost_per_million, cached_input_cost)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const m of PRICING) {
    stmt.run([
      m.provider,
      m.modelName,
      m.inputCostPerMillion,
      m.outputCostPerMillion,
      m.cachedInputCost,
    ]);
  }

  stmt.free();
  saveDatabase();
}
