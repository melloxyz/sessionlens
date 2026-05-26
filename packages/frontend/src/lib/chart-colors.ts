export const CHART_COLORS = ['#22c55e', '#8b5cf6', '#f97316', '#38bdf8', '#eab308', '#ef4444', '#14b8a6'];

export const CLI_COLORS: Record<string, string> = {
  codex: '#8b5cf6',
  opencode: '#22c55e',
  claude: '#f97316',
};

export function chartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
