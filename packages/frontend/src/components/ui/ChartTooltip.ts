import type { CSSProperties } from 'react';

const tooltipSurface: CSSProperties = {
  background: 'color-mix(in srgb, var(--surface-elevated), transparent 2%)',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  color: 'var(--foreground)',
  boxShadow: '0 18px 48px rgba(0, 0, 0, 0.24), 0 4px 14px rgba(0, 0, 0, 0.16)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 1.45,
  padding: '10px 12px',
};

export const chartTooltipProps = {
  allowEscapeViewBox: { x: true, y: true },
  contentStyle: tooltipSurface,
  cursor: {
    stroke: 'var(--border-strong)',
    strokeDasharray: '4 4',
    strokeWidth: 1,
  },
  itemStyle: {
    color: 'var(--foreground)',
    display: 'flex',
    gap: 8,
    padding: '2px 0',
  } satisfies CSSProperties,
  labelStyle: {
    color: 'var(--subtle-foreground)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    marginBottom: 6,
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  wrapperStyle: {
    outline: 'none',
    pointerEvents: 'none',
    zIndex: 90,
  } satisfies CSSProperties,
};
