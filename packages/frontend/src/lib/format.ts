export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(2)}`;
}

export function formatTokens(value: number | null | undefined): string {
  if (value == null) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function compactPath(path: string | null | undefined): string {
  if (!path) return '—';
  const cleaned = path.replace(/^\\\\\?\\/, '');
  const parts = cleaned.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return `~/.../${parts.slice(-2).join('/')}`;
}

export function basename(path: string | null | undefined): string {
  if (!path) return 'unknown';
  return path.replace(/^\\\\\?\\/, '').split(/[\\/]/).filter(Boolean).pop() ?? path;
}
