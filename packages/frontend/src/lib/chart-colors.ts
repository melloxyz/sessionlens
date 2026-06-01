export const CHART_COLORS = [
  '#4f7cff',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
];

export const CLI_COLORS: Record<string, string> = {
  codex: '#10a37f',
  opencode: '#7c6f64',
  claude: '#9a5a00',
  gemini: '#235f9f',
  kimi: '#178f8f',
  aider: '#087443',
  qwen: '#5b54b6',
  antigravity: '#b26b00',
  commandcode: '#4f7cff',
};

export function chartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
