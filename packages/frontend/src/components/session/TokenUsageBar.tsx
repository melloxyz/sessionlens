import { formatTokens } from '../../lib/format.js';

interface TokenUsageBarProps {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
}

export function TokenUsageBar({
  input,
  output,
  cacheRead = 0,
  cacheWrite = 0,
  reasoning = 0,
}: TokenUsageBarProps) {
  const total = Math.max(1, input + output + cacheRead + cacheWrite + reasoning);
  const rows = [
    { label: 'Input', value: input, color: 'bg-success' },
    { label: 'Output', value: output, color: 'bg-accent' },
    { label: 'Cache Read', value: cacheRead, color: 'bg-info' },
    { label: 'Cache Write', value: cacheWrite, color: 'bg-warning' },
    ...(reasoning > 0 ? [{ label: 'Reasoning', value: reasoning, color: 'bg-danger' }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted ring-1 ring-border">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.color}
            style={{ width: `${(row.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${row.color}`} />
              {row.label}
            </div>
            <div className="text-sm font-medium text-foreground">
              {formatTokens(row.value)}{' '}
              <span className="text-xs text-subtle-foreground">
                ({((row.value / total) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
