import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  Gauge,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { formatCurrency, formatTokens } from '../lib/format.js';
import { chartColor } from '../lib/chart-colors.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import { MetricBlock } from '../components/ui/MetricBlock.js';
import { SectionHeader } from '../components/ui/SectionHeader.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { chartTooltipProps } from '../components/ui/ChartTooltip.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

interface InsightDetailData {
  id: string;
  kind: string;
  type: 'insight' | 'anomaly';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
  sessionId?: string;
  context: {
    trend?: { date: string; spend: number }[];
    current7DaySpend?: number;
    previous7DaySpend?: number;
    growthPercent?: number | null;
    baselineDailySpend?: number;
    projectId?: number;
    projectPath?: string;
    projectSpend?: number;
    projectSessions?: number;
    projectTopModels?: { provider: string; model: string; cost: number }[];
    modelProvider?: string;
    modelName?: string;
    modelSpend?: number;
    modelAvgCost?: number;
    modelAvgMessages?: number;
    cacheMissRate?: number | null;
    topCacheWasteSessions?: { sessionId: string; missRate: number; tokens: number }[];
    spikeDate?: string;
    spikeSpend?: number;
    outlierTokens?: number;
    outlierCost?: number;
    avgTokens?: number;
    avgCost?: number;
    stdTokens?: number;
    stdCost?: number;
    totalSpend?: number;
    totalSessions?: number;
    overallAvgCost?: number;
    overallAvgCacheMiss?: number | null;
  };
  recommendations: {
    title: string;
    description: string;
    url?: string;
    action?: string;
  }[];
}

export function InsightDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { t, locale } = useI18n();
  const { queryString } = useDateRange();
  const previewState = location.state as {
    insightPreview?: Pick<
      InsightDetailData,
      'id' | 'kind' | 'type' | 'severity' | 'title' | 'description' | 'value' | 'sessionId'
    >;
  } | null;
  const previewDetail =
    previewState?.insightPreview && previewState.insightPreview.id === id
      ? {
          ...previewState.insightPreview,
          context: {},
          recommendations: [],
        }
      : undefined;

  const queryPrefix = queryString ? `?${queryString}` : '';
  const {
    data: detail,
    loading,
    validating,
    error,
  } = useApi<InsightDetailData>(`/api/analytics/insights/${id}${queryPrefix}`, {
    initialData: previewDetail,
    immediate: Boolean(id),
  });

  const recs = detail?.recommendations ?? [];
  const localizedRecs = detail ? localizeRecommendations(detail.kind, recs, t) : recs;

  const insightTypeLabel =
    detail?.type === 'anomaly' ? t('analytics.anomaly') : t('analytics.insight');

  const localizedDetail = detail ? localizeDetailItem(detail, locale) : null;

  const backLink = queryString ? `/analytics${queryPrefix}` : '/analytics';
  const projectLink = detail?.context.projectPath
    ? `/projects/${encodeURIComponent(detail.context.projectPath)}`
    : detail?.context.projectId != null
      ? `/projects/${detail.context.projectId}`
      : null;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      {error && (
        <ErrorState
          title={t('insightDetail.notFound.title')}
          message={
            error.code === 'INSIGHT_NOT_FOUND'
              ? t('insightDetail.notFound.description')
              : error.message
          }
          code={error.code}
          details={error.details}
          onRetry={() => window.location.reload()}
        />
      )}

      {!error && (
        <Link
          to={backLink}
          className="inline-flex items-center gap-1.5 text-sm text-subtle-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('insightDetail.backToAnalytics')}
        </Link>
      )}

      {validating && detail && (
        <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-subtle-foreground">
          {t('insightDetail.loadingEvidence')}
        </div>
      )}

      {loading && !detail && (
        <div className="space-y-5">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      )}

      {detail && (
        <>
          <FigurePanel
            figure={
              detail.type === 'anomaly'
                ? t('insightDetail.figure.finding')
                : t('insightDetail.figure.insight')
            }
            title={localizedDetail?.title ?? detail.title}
            description={localizedDetail?.description ?? detail.description}
            meta={
              <>
                <Badge
                  variant={
                    detail.severity === 'high'
                      ? 'danger'
                      : detail.severity === 'medium'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {detail.kind}
                </Badge>
                <Badge variant="neutral">{insightTypeLabel}</Badge>
              </>
            }
            contentClassName="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]"
          >
            <div className="rounded-md border border-border bg-surface-muted p-4 text-sm leading-6 text-muted-foreground">
              {localizedDetail?.description ?? detail.description}
            </div>
            <MetricBlock
              variant="compact"
              label={insightTypeLabel}
              value={detail.value}
              tone={
                detail.severity === 'high'
                  ? 'danger'
                  : detail.severity === 'medium'
                    ? 'warning'
                    : 'info'
              }
              meta={detail.kind}
            />
          </FigurePanel>

          <SectionHeader
            title={t('insightDetail.context')}
            description={t('insightDetail.trendDescription')}
          />

          <div className="grid grid-cols-1 gap-4">
            {detail.context.trend && detail.context.trend.length > 0 && (
              <FigurePanel
                figure="EVIDENCE 01"
                title={t('insightDetail.trend')}
                description={t('insightDetail.trendDescription')}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={detail.context.trend}>
                    <defs>
                      <linearGradient id="contextGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => [formatCurrency(value), t('common.cost')]}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="var(--accent)"
                      fill="url(#contextGrad)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: 'var(--accent)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </FigurePanel>
            )}

            {((detail.kind === 'growth' && detail.context.trend) ||
              (detail.kind === 'spend' && detail.context.spikeSpend != null)) && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SummaryCard
                  icon={TrendingUp}
                  label={t('insightDetail.growth7d')}
                  value={formatCurrency(detail.context.current7DaySpend)}
                  sub={
                    detail.context.growthPercent != null
                      ? `${detail.context.growthPercent >= 0 ? '+' : ''}${detail.context.growthPercent.toFixed(0)}% ${t('insightDetail.growthPercent')}`
                      : '—'
                  }
                  tone={detail.kind === 'growth' ? 'warning' : 'info'}
                />
                <SummaryCard
                  icon={Gauge}
                  label={t('insightDetail.baseline')}
                  value={formatCurrency(detail.context.baselineDailySpend)}
                  sub={`${t('common.daily')} 7d`}
                  tone="info"
                />
                <SummaryCard
                  icon={Sparkles}
                  label={t('insightDetail.sessions')}
                  value={String(detail.context.totalSessions ?? '—')}
                  sub={
                    detail.context.overallAvgCost != null
                      ? `${formatCurrency(detail.context.overallAvgCost)} ${t('common.cost').toLowerCase()}`
                      : ''
                  }
                  tone="info"
                />
              </div>
            )}
          </div>

          {detail.kind === 'project' && detail.context.projectPath && (
            <Card>
              <CardHeader>
                <CardTitle>{detail.context.projectPath}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={TrendingUp}
                    label={t('common.cost')}
                    value={formatCurrency(detail.context.projectSpend)}
                    sub={`${detail.context.projectSessions} ${t('common.sessions').toLowerCase()}`}
                    tone="warning"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={t('insightDetail.growthPercent')}
                    value={
                      detail.context.totalSpend && detail.context.projectSpend
                        ? `${((detail.context.projectSpend / detail.context.totalSpend) * 100).toFixed(0)}%`
                        : '—'
                    }
                    sub={t('common.of') + ' ' + t('common.total').toLowerCase()}
                    tone="info"
                  />
                  <div className="rounded-lg border border-border bg-surface-elevated p-4">
                    <Link
                      to={projectLink ?? '/projects'}
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      {t('insightDetail.viewProject')}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                {(detail.context.projectTopModels?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-medium text-foreground">
                      {t('insightDetail.projectModels')}
                    </div>
                    {detail.context.projectTopModels!.slice(0, 5).map((m, i) => (
                      <div
                        key={`${m.provider}/${m.model}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: chartColor(i) }}
                          />
                          <span className="text-foreground">
                            {m.provider}/{m.model}
                          </span>
                        </div>
                        <span className="font-mono font-medium text-foreground">
                          {formatCurrency(m.cost)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detail.kind === 'model' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.modelUsage')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={TrendingUp}
                    label={t('insightDetail.modelCost')}
                    value={formatCurrency(detail.context.modelSpend)}
                    sub={`${detail.context.modelProvider}/${detail.context.modelName}`}
                    tone="warning"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={t('insightDetail.average')}
                    value={formatCurrency(detail.context.modelAvgCost)}
                    sub={t('common.per') + ' ' + t('common.session').toLowerCase()}
                    tone="info"
                  />
                  <SummaryCard
                    icon={Sparkles}
                    label={t('common.messages')}
                    value={formatTokens(detail.context.modelAvgMessages)}
                    sub={t('common.per') + ' ' + t('common.session').toLowerCase()}
                    tone="info"
                  />
                </div>
                {detail.context.overallAvgCost != null && (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-4 font-mono text-xs text-subtle-foreground">
                    {t('insightDetail.average')} {t('common.cost').toLowerCase()}/
                    {t('common.session').toLowerCase()}:{' '}
                    <span className="font-medium text-foreground">
                      {formatCurrency(detail.context.overallAvgCost)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detail.kind === 'session' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.costOutlier')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={TrendingUp}
                    label={t('common.cost')}
                    value={formatCurrency(detail.context.outlierCost)}
                    sub={
                      detail.context.overallAvgCost != null
                        ? `${(((detail.context.outlierCost ?? 0) / Math.max(detail.context.overallAvgCost, 0.01) - 1) * 100).toFixed(0)}% ${t('insightDetail.vsBaseline')}`
                        : ''
                    }
                    tone="warning"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={t('insightDetail.average') + ' ' + t('common.cost').toLowerCase()}
                    value={formatCurrency(detail.context.overallAvgCost)}
                    sub={`${detail.context.totalSessions} ${t('insightDetail.sessions')}`}
                    tone="info"
                  />
                  {detail.sessionId && (
                    <div className="rounded-lg border border-border bg-surface-elevated p-4">
                      <Link
                        to={`/sessions/${detail.sessionId}`}
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                      >
                        {t('insightDetail.viewSession')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {detail.kind === 'cache' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.cacheStats')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={CircleAlert}
                    label={t('insightDetail.cacheMissRate')}
                    value={
                      detail.context.cacheMissRate != null
                        ? `${(detail.context.cacheMissRate * 100).toFixed(0)}%`
                        : '—'
                    }
                    tone="danger"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={
                      t('insightDetail.average') +
                      ' ' +
                      t('insightDetail.cacheMissRate').toLowerCase()
                    }
                    value={
                      detail.context.overallAvgCacheMiss != null
                        ? `${(detail.context.overallAvgCacheMiss * 100).toFixed(0)}%`
                        : '—'
                    }
                    sub={t('insightDetail.vsBaseline')}
                    tone="info"
                  />
                  {detail.sessionId && (
                    <div className="rounded-lg border border-border bg-surface-elevated p-4">
                      <Link
                        to={`/sessions/${detail.sessionId}`}
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                      >
                        {t('insightDetail.viewSession')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
                {(detail.context.topCacheWasteSessions?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-medium text-foreground">
                      {t('insightDetail.topWasteSessions')}
                    </div>
                    {detail.context.topCacheWasteSessions!.map((s, i) => (
                      <Link
                        key={s.sessionId}
                        to={`/sessions/${s.sessionId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm hover:bg-surface-hover"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: chartColor(i) }}
                          />
                          <span className="font-mono text-foreground">
                            {s.sessionId.slice(0, 12)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-subtle-foreground">
                            {s.missRate.toFixed(0)}% {t('insightDetail.miss')}
                          </span>
                          <span className="font-mono text-foreground">
                            {formatTokens(s.tokens)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-subtle-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detail.kind === 'spend' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.spikeDay')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={TrendingUp}
                    label={t('common.cost')}
                    value={formatCurrency(detail.context.spikeSpend)}
                    sub={detail.context.spikeDate ?? ''}
                    tone="danger"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={t('insightDetail.baseline')}
                    value={formatCurrency(detail.context.baselineDailySpend)}
                    sub={`${t('common.daily')} 7d`}
                    tone="info"
                  />
                  <SummaryCard
                    icon={Sparkles}
                    label={t('insightDetail.multiplier')}
                    value={
                      detail.context.baselineDailySpend && detail.context.baselineDailySpend > 0
                        ? `${((detail.context.spikeSpend ?? 0) / detail.context.baselineDailySpend).toFixed(1)}x`
                        : '—'
                    }
                    sub={t('insightDetail.vsBaseline')}
                    tone="warning"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {detail.kind === 'token' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.tokenOutlier')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={TrendingUp}
                    label={t('common.tokens')}
                    value={formatTokens(detail.context.outlierTokens)}
                    tone="danger"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={t('insightDetail.average')}
                    value={formatTokens(detail.context.avgTokens)}
                    sub={`±${formatTokens(detail.context.stdTokens)} ${t('insightDetail.stddev')}`}
                    tone="info"
                  />
                  {detail.sessionId && (
                    <div className="rounded-lg border border-border bg-surface-elevated p-4">
                      <Link
                        to={`/sessions/${detail.sessionId}`}
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                      >
                        {t('insightDetail.viewSession')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {detail.kind === 'costOutlier' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.costOutlier')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={TrendingUp}
                    label={t('common.cost')}
                    value={formatCurrency(detail.context.outlierCost)}
                    tone="danger"
                  />
                  <SummaryCard
                    icon={Gauge}
                    label={t('insightDetail.average')}
                    value={formatCurrency(detail.context.avgCost)}
                    sub={`±${formatCurrency(detail.context.stdCost)} ${t('insightDetail.stddev')}`}
                    tone="info"
                  />
                  {detail.sessionId && (
                    <div className="rounded-lg border border-border bg-surface-elevated p-4">
                      <Link
                        to={`/sessions/${detail.sessionId}`}
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                      >
                        {t('insightDetail.viewSession')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {detail.kind === 'cacheBasin' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('insightDetail.cacheStats')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SummaryCard
                    icon={CircleAlert}
                    label={t('insightDetail.cacheMissRate')}
                    value={
                      detail.context.overallAvgCacheMiss != null
                        ? `${(detail.context.overallAvgCacheMiss * 100).toFixed(0)}%`
                        : '—'
                    }
                    sub={t('insightDetail.average')}
                    tone="danger"
                  />
                  <div className="rounded-lg border border-border bg-surface-elevated p-4">
                    <Link
                      to="/models"
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      {t('insightDetail.rec.cacheBasin.consistency')}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                {(detail.context.topCacheWasteSessions?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-medium text-foreground">
                      {t('insightDetail.topWasteSessions')}
                    </div>
                    {detail.context.topCacheWasteSessions!.map((s, i) => (
                      <Link
                        key={s.sessionId}
                        to={`/sessions/${s.sessionId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm hover:bg-surface-hover"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: chartColor(i) }}
                          />
                          <span className="font-mono text-foreground">
                            {s.sessionId.slice(0, 12)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-subtle-foreground">
                            {s.missRate.toFixed(0)}% miss
                          </span>
                          <span className="font-mono text-foreground">
                            {formatTokens(s.tokens)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-subtle-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {recs.length > 0 && (
            <>
              <SectionHeader
                title={t('insightDetail.recommendations')}
                description={t('analytics.actionableFindings')}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {localizedRecs.map((rec, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="mb-2">
                        {rec.url ? (
                          <Link
                            to={rec.url}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent"
                          >
                            {rec.title}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <div className="text-sm font-medium text-foreground">{rec.title}</div>
                        )}
                      </div>
                      <p className="text-xs text-subtle-foreground">{rec.description}</p>
                    </CardHeader>
                    {rec.action && (
                      <CardContent>
                        {rec.url ? (
                          <Link to={rec.url}>
                            <Button variant="outline" size="sm" className="w-full">
                              {rec.action}
                            </Button>
                          </Link>
                        ) : detail.sessionId ? (
                          <Link to={`/sessions/${detail.sessionId}`}>
                            <Button variant="outline" size="sm" className="w-full">
                              {rec.action}
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full" disabled>
                            {rec.action}
                          </Button>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}

          <SectionHeader title={t('insightDetail.explore')} />
          <div className="flex flex-wrap gap-3">
            <Link to={backLink}>
              <Button variant="outline" size="sm">
                {t('insightDetail.viewInAnalytics')}
              </Button>
            </Link>
            {detail.sessionId && (
              <Link to={`/sessions/${detail.sessionId}`}>
                <Button variant="outline" size="sm">
                  {t('insightDetail.viewSession')}
                </Button>
              </Link>
            )}
            {projectLink && (
              <Link to={projectLink}>
                <Button variant="outline" size="sm">
                  {t('insightDetail.viewProject')}
                </Button>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function localizeRecommendations(
  kind: string,
  recs: InsightDetailData['recommendations'],
  t: (key: string) => string,
) {
  const keyMap: Record<string, [string, string, string][]> = {
    growth: [
      ['insightDetail.rec.growth.budget', 'insightDetail.rec.growth.budgetDesc', 'budget'],
      ['insightDetail.rec.growth.review', 'insightDetail.rec.growth.reviewDesc', 'review'],
      [
        'insightDetail.rec.growth.cheaperModel',
        'insightDetail.rec.growth.cheaperModelDesc',
        'compare',
      ],
    ],
    project: [
      ['insightDetail.rec.project.budget', 'insightDetail.rec.project.budgetDesc', 'budget'],
      ['insightDetail.rec.project.detail', 'insightDetail.rec.project.detailDesc', 'detail'],
      ['insightDetail.rec.project.review', 'insightDetail.rec.project.reviewDesc', 'review'],
    ],
    model: [
      ['insightDetail.rec.model.cheaper', 'insightDetail.rec.model.cheaperDesc', 'compare'],
      ['insightDetail.rec.model.cap', 'insightDetail.rec.model.capDesc', 'budget'],
      ['insightDetail.rec.model.audit', 'insightDetail.rec.model.auditDesc', 'review'],
    ],
    session: [
      ['insightDetail.rec.session.review', 'insightDetail.rec.session.reviewDesc', 'review'],
      ['insightDetail.rec.session.alert', 'insightDetail.rec.session.alertDesc', 'budget'],
      ['insightDetail.rec.session.cheaper', 'insightDetail.rec.session.cheaperDesc', 'compare'],
    ],
    cache: [
      ['insightDetail.rec.cache.prompts', 'insightDetail.rec.cache.promptsDesc', 'review'],
      ['insightDetail.rec.cache.context', 'insightDetail.rec.cache.contextDesc', 'review'],
      ['insightDetail.rec.cache.review', 'insightDetail.rec.cache.reviewDesc', 'review'],
    ],
    spend: [
      ['insightDetail.rec.spend.planned', 'insightDetail.rec.spend.plannedDesc', 'review'],
      ['insightDetail.rec.spend.dailyBudget', 'insightDetail.rec.spend.dailyBudgetDesc', 'budget'],
      ['insightDetail.rec.spend.reviewDay', 'insightDetail.rec.spend.reviewDayDesc', 'review'],
    ],
    token: [
      ['insightDetail.rec.token.context', 'insightDetail.rec.token.contextDesc', 'review'],
      ['insightDetail.rec.token.caching', 'insightDetail.rec.token.cachingDesc', 'learn'],
      ['insightDetail.rec.token.alert', 'insightDetail.rec.token.alertDesc', 'budget'],
    ],
    costOutlier: [
      [
        'insightDetail.rec.costOutlier.review',
        'insightDetail.rec.costOutlier.reviewDesc',
        'review',
      ],
      ['insightDetail.rec.costOutlier.alert', 'insightDetail.rec.costOutlier.alertDesc', 'budget'],
      ['insightDetail.rec.costOutlier.model', 'insightDetail.rec.costOutlier.modelDesc', 'compare'],
    ],
    cacheBasin: [
      [
        'insightDetail.rec.cacheBasin.systemPrompt',
        'insightDetail.rec.cacheBasin.systemPromptDesc',
        'review',
      ],
      [
        'insightDetail.rec.cacheBasin.consistency',
        'insightDetail.rec.cacheBasin.consistencyDesc',
        'review',
      ],
      [
        'insightDetail.rec.cacheBasin.reviewPattern',
        'insightDetail.rec.cacheBasin.reviewPatternDesc',
        'review',
      ],
    ],
  };

  const actionMap: Record<string, string> = {
    budget: t('insightDetail.action.openBudgets'),
    review: t('insightDetail.action.review'),
    compare: t('insightDetail.action.compareModels'),
    detail: t('insightDetail.action.openProject'),
    learn: t('insightDetail.action.learnMore'),
  };

  return recs.map((rec, index) => {
    const mapping = keyMap[kind]?.[index];
    if (!mapping) return rec;
    const [titleKey, descriptionKey, actionKey] = mapping;
    return {
      ...rec,
      title: t(titleKey),
      description: t(descriptionKey),
      action: rec.action ? (actionMap[actionKey] ?? rec.action) : rec.action,
    };
  });
}

function localizeDetailItem(
  detail: InsightDetailData,
  locale: string,
): { title: string; description: string } {
  if (locale !== 'pt-BR') return { title: detail.title, description: detail.description };

  if (detail.id === 'spend-growth')
    return {
      title: 'Uso crescendo mais rápido que na semana passada',
      description: detail.description
        .replace('The last 7 days spent', 'Os últimos 7 dias gastaram')
        .replace('more than the previous 7 days.', 'a mais que os 7 dias anteriores.'),
    };
  if (detail.id.startsWith('project-'))
    return {
      title: 'Um projeto domina os gastos',
      description: detail.description
        .replace('is the highest-cost project and takes', 'é o projeto de maior custo e representa')
        .replace('of total spend.', 'do gasto total.'),
    };
  if (detail.id.startsWith('model-'))
    return {
      title: 'Modelo caro usado em sessões leves',
      description: detail.description
        .replace('averages', 'tem média de')
        .replace(
          'messages per session while staying well above the overall average cost.',
          'mensagens por sessão enquanto fica bem acima do custo médio geral.',
        ),
    };
  if (detail.id.startsWith('session-'))
    return {
      title: 'Sessão longa e cara detectada',
      description: detail.description
        .replace('Session', 'A sessão')
        .replace(
          'is among the priciest entries and may deserve a closer look.',
          'está entre as entradas mais caras e pode merecer uma análise.',
        ),
    };
  if (detail.id.startsWith('cache-') && detail.id !== 'cache-basin')
    return {
      title: 'Alto desperdício de contexto em uma sessão',
      description: detail.description.replace(
        'is missing cache hits for most of its input tokens.',
        'não teve cache hit na maior parte dos tokens de entrada.',
      ),
    };
  if (detail.id.startsWith('spike-'))
    return {
      title: 'Pico diário de gasto',
      description: detail.description
        .replace('The latest day spent', 'O último dia gastou')
        .replace('more than the 7-day baseline.', 'a mais que a baseline de 7 dias.'),
    };
  if (detail.id.startsWith('tokens-'))
    return {
      title: 'Outlier de uso de tokens',
      description: detail.description
        .replace('Session', 'A sessão')
        .replace(
          'used far more tokens than the typical session.',
          'usou muito mais tokens que uma sessão típica.',
        ),
    };
  if (detail.id.startsWith('cost-'))
    return {
      title: 'Outlier de sessão de alto custo',
      description: detail.description
        .replace('Session', 'A sessão')
        .replace(
          'is much more expensive than the average session.',
          'é muito mais cara que a sessão média.',
        ),
    };
  if (detail.id === 'cache-basin')
    return {
      title: 'Taxa geral alta de cache miss',
      description: 'Nas sessões analisadas, os cache misses continuam elevados.',
    };

  return { title: detail.title, description: detail.description };
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <MetricBlock variant="compact" icon={Icon} label={label} value={value} meta={sub} tone={tone} />
  );
}
