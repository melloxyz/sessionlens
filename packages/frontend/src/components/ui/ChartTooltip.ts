import type { CSSProperties } from 'react';

const tooltipSurface: CSSProperties = {
  background: 'color-mix(in srgb, var(--surface-elevated), transparent 2%)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  color: 'var(--foreground)',
  boxShadow: 'var(--shadow-floating)',
  fontFamily: 'var(--font-sans)',
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
    marginBottom: 6,
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  wrapperStyle: {
    outline: 'none',
    pointerEvents: 'none',
    zIndex: 90,
  } satisfies CSSProperties,
};
