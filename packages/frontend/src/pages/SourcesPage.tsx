import { AlertTriangle, ExternalLink, Layers } from 'lucide-react';
import { BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import { PageSkeleton } from '../components/ui/LoadingState.js';
import { useApi } from '../hooks/useApi.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { formatRelativeTime } from '../lib/format.js';
import type { IntegrationStatusItem } from '../components/layout/IntegrationStatus.js';

// ─── Capability display ───────────────────────────────────────────────────────

const CAP_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  real: 'success',
  actual: 'success',
  estimated: 'warning',
  partial: 'info',
  unavailable: 'neutral',
  unknown: 'neutral',
};

const CAP_SHORT: Record<string, string> = {
  real: 'real',
  actual: 'real',
  estimated: '~est',
  partial: 'partial',
  unavailable: 'N/A',
  unknown: '?',
};

const CAP_TOOLTIP: Record<string, Record<string, string>> = {
  cost: {
    real: 'Cost reported directly by the CLI billing API',
    estimated: 'Cost estimated from token counts via pricing table — may not match your bill',
    unknown: 'CLI does not expose tokens or billing in local files',
  },
  tokens: {
    real: 'Token counts reported directly by the CLI',
    estimated: 'Token counts approximated from message length',
    unavailable: 'No token data available from this CLI',
    partial: 'Some token fields missing (e.g. cache or reasoning tokens)',
  },
  model: {
    real: 'Model name captured directly from session data',
    inferred: 'Model inferred from context — may not be exact',
    unknown: 'Model name not available from this CLI',
  },
  messages: {
    real: 'Full conversation messages captured',
    partial: 'Only some messages captured',
    unavailable: 'No message content available from this CLI',
  },
  toolCalls: {
    real: 'Tool calls captured with full detail',
    partial: 'Tool calls captured but with limited detail',
    unavailable: 'Tool calls not available from this CLI',
  },
  fileReads: {
    real: 'File reads tracked',
    partial: 'File reads partially tracked',
    unavailable: 'File reads not available from this CLI',
  },
  fileWrites: {
    real: 'File writes tracked',
    partial: 'File writes partially tracked',
    unavailable: 'File writes not available from this CLI',
  },
  duration: {
    real: 'Session duration calculated from timestamps',
    unavailable: 'Duration not available from this CLI',
  },
  multiModel: {
    real: 'Multiple models per session tracked',
    unavailable: 'Single-model sessions only',
  },
};

const ALL_CAP_KEYS = [
  'cost',
  'tokens',
  'model',
  'messages',
  'toolCalls',
  'fileReads',
  'fileWrites',
  'duration',
  'multiModel',
] as const;

function CapabilityPill({ name, level }: { name: string; level: string }) {
  const variant = CAP_VARIANT[level] ?? 'neutral';
  const short = CAP_SHORT[level] ?? level;
  const tooltip = CAP_TOOLTIP[name]?.[level] ?? `${name}: ${level}`;
  return (
    <Badge variant={variant} title={tooltip} className="gap-1">
      <span className="text-[10px] font-mono opacity-60">{name}:</span>
      <span className="text-[10px] font-mono">{short}</span>
    </Badge>
  );
}

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({ item }: { item: IntegrationStatusItem }) {
  const { t } = useI18n();
  const available = item.status === 'available';
  const caps = item.capabilities ?? {};
  const driftCount =
    (item.sessionsZeroTokens ?? 0) + (item.sessionsNoCost ?? 0) + (item.sessionsNoModel ?? 0);

  return (
    <Card variant="outlined" className={available ? '' : 'opacity-50'}>
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark value={item.cli} size="md" />
            <div>
              <div className="font-semibold text-foreground">{getBrandMeta(item.cli).label}</div>
              <div className="font-mono text-[11px] text-subtle-foreground">{item.cli}</div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant={available ? 'success' : 'neutral'}>
              {available ? t('common.detected') : t('common.missing')}
            </Badge>
            {available && typeof item.completenessScore === 'number' && (
              <span className="font-mono text-xs text-muted-foreground">
                {item.completenessScore}% coverage
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {available && (
          <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-surface-muted p-3">
            <div className="text-center">
              <div className="font-mono text-lg font-semibold text-foreground">
                {item.pathsFound ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground">paths</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-semibold text-foreground">
                {item.sessionsIndexed ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground">sessions</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg font-semibold text-foreground">
                {item.completenessScore ?? 0}%
              </div>
              <div className="text-[11px] text-muted-foreground">completeness</div>
            </div>
          </div>
        )}

        {/* Capabilities */}
        {available && Object.keys(caps).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ALL_CAP_KEYS.map((key) =>
              caps[key] ? <CapabilityPill key={key} name={key} level={caps[key]} /> : null,
            )}
          </div>
        )}

        {/* Drift warning */}
        {available && driftCount > 0 && (
          <Badge
            variant="warning"
            className="w-full justify-center"
            title={`${item.sessionsZeroTokens ?? 0} zero-token · ${item.sessionsNoCost ?? 0} no-cost · ${item.sessionsNoModel ?? 0} no-model`}
          >
            <AlertTriangle className="h-3 w-3" />
            {driftCount} sessions with missing data
          </Badge>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            {item.lastSessionAt ? (
              <span className="text-xs text-muted-foreground">
                Last session {formatRelativeTime(item.lastSessionAt)}
              </span>
            ) : item.lastIngestedAt ? (
              <span className="text-xs text-muted-foreground">
                Last ingested {formatRelativeTime(item.lastIngestedAt)}
              </span>
            ) : (
              <span className="text-xs text-subtle-foreground">No sessions yet</span>
            )}
          </div>
          {available && (
            <button
              type="button"
              title="Open source folder"
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              onClick={async () => {
                await fetch(`/api/integrations/${item.cli}/open`, { method: 'POST' });
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Open folder
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SourcesPage() {
  const { data, loading } = useApi<{ integrations: IntegrationStatusItem[] }>(
    '/api/integrations/status',
    { initialData: { integrations: [] } },
  );

  const all = data?.integrations ?? [];
  const detected = all.filter((i) => i.status === 'available');
  const missing = all.filter((i) => i.status !== 'available');
  const totalSessions = detected.reduce((sum, i) => sum + (i.sessionsIndexed ?? 0), 0);

  if (loading && all.length === 0) return <PageSkeleton />;

  return (
    <div className="p-4 lg:p-8">
      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Adapters detected', value: detected.length },
          { label: 'Total adapters', value: all.length },
          { label: 'Sessions indexed', value: totalSessions },
          {
            label: 'Avg coverage',
            value:
              detected.length > 0
                ? `${Math.round(detected.reduce((s, i) => s + (i.completenessScore ?? 0), 0) / detected.length)}%`
                : '—',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-border bg-surface-muted p-3 text-center"
          >
            <div className="font-mono text-2xl font-semibold text-foreground">{stat.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {detected.length === 0 && missing.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No adapters found"
          description="Run an ingestion to detect CLI sources on this machine."
        />
      )}

      {/* Detected sources */}
      {detected.length > 0 && (
        <FigurePanel
          figure="SOURCES 01"
          title="Detected sources"
          description={`${detected.length} CLI${detected.length !== 1 ? 's' : ''} found on this machine`}
          className="mb-6"
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {detected
              .sort((a, b) => {
                const aDate = a.lastSessionAt ?? a.lastIngestedAt;
                const bDate = b.lastSessionAt ?? b.lastIngestedAt;
                if (!aDate && !bDate) return 0;
                if (!aDate) return 1;
                if (!bDate) return -1;
                return new Date(bDate).getTime() - new Date(aDate).getTime();
              })
              .map((item) => (
                <SourceCard key={item.cli} item={item} />
              ))}
          </div>
        </FigurePanel>
      )}

      {/* Not detected */}
      {missing.length > 0 && (
        <FigurePanel
          figure="SOURCES 02"
          title="Not detected"
          description="These CLI adapters are supported but not found on this machine"
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {missing.map((item) => (
              <SourceCard key={item.cli} item={item} />
            ))}
          </div>
        </FigurePanel>
      )}
    </div>
  );
}
