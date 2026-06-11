/**
 * Maps raw provider strings (from adapters or OpenRouter) to canonical lowercase names.
 * github-copilot uses OpenAI models under the hood, so it resolves to 'openai' for pricing.
 */
const PROVIDER_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  deepseek: 'deepseek',
  minimax: 'minimax',
  opencode: 'opencode',
  'github-copilot': 'openai',
};

export function normalizeProvider(raw: string): string {
  const lower = raw.toLowerCase();
  return PROVIDER_MAP[lower] ?? lower;
}

/**
 * Strips the provider prefix (everything before the first '/') and lowercases.
 * Returns null when input is null or undefined.
 */
export function normalizeModel(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const lower = raw.toLowerCase();
  return lower.includes('/') ? lower.split('/').slice(1).join('/') : lower;
}
