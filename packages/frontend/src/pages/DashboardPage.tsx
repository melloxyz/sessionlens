import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  Gauge,
  MoreHorizontal,
  Network,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BrandBadge, BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { AlertStrip } from '../components/ui/AlertStrip.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '../components/ui/DataTable.js';
import { TokenUsageBar } from '../components/session/TokenUsageBar.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import {
  ChartSkeleton,
  DonutSkeleton,
  PanelSkeleton,
  TableSkeletonRows,
} from '../components/ui/LoadingState.js';
import { chartTooltipProps } from '../components/ui/ChartTooltip.js';
import { Sensitive } from '../components/ui/Sensitive.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { CLI_COLORS, chartColor } from '../lib/chart-colors.js';
import {
  basename,
  compactPath,
  formatCurrency,
  formatDate,
  formatDuration,
  formatRelativeTime,
  formatTokens,
} from '../lib/format.js';

interface Overview {
  todaySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  totalSpend: number;
  sessionCount: number;
  averageSessionCost: number;
  mostUsedCli: string | null;
  totalDurationMs: number;
  totalMessages: number;
  confirmedSpend: number;
  estimatedSpend: number;
}

interface SessionRow {
  id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  total_cost_usd: number | null;
  cost_source: 'actual' | 'estimated' | 'unknown';
  source_confidence: string;
  message_count: number;
  tool_call_count: number;
  session_id: string;
}

interface SessionDetail extends SessionRow {
  usageEvents: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    reasoning_tokens: number;
    tool_calls_count: number;
  }[];
  messages: { id: number; role: string; content: string; timestamp: string }[];
}

interface BudgetStatusItem {
  id: number;
  scope_type: string;
  scope_value: string | null;
  limit_usd: number;
  period: string;
  current_spend: number;
  percentage: number;
  status: 'ok' | 'warning' | 'approaching' | 'exceeded';
}

type QualityTone = 'real' | 'partial' | 'estimated' | 'unknown';

export function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { queryString, range } = useDateRange();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryPrefix = queryString ? `?${queryString}` : '';
  const querySuffix = queryString ? `&${queryString}` : '';
  const {
    data: overview,
    loading: overviewLoading,
    validating: overviewValidating,
    error: overviewError,
  } = useApi<Overview>(`/api/overview${queryPrefix}`);
  const {
    data: spendData,
    loading: spendLoading,
    validating: spendValidating,
    error: spendError,
  } = useApi<{
    points: { date: string; spend: number; tokens: number; sessions: number }[];
  }>(`/api/analytics/spend-over-time${queryPrefix}`);
  const {
    data: tokenData,
    loading: tokenLoading,
    validating: tokenValidating,
    error: tokenError,
  } = useApi<{
    points: {
      date: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    }[];
  }>(`/api/analytics/tokens-over-time${queryPrefix}`);
  const {
    data: cliBreakdown,
    loading: cliLoading,
    validating: cliValidating,
    error: cliError,
  } = useApi<{
    breakdown: { label: string; value: number; percentage: number }[];
  }>(`/api/analytics/breakdown?dimension=cli&metric=cost${querySuffix}`);
  const {
    data: modelBreakdown,
    loading: modelLoading,
    validating: modelValidating,
    error: modelError,
  } = useApi<{
    breakdown: { label: string; value: number; percentage: number }[];
  }>(`/api/analytics/breakdown?dimension=model&metric=cost${querySuffix}`);
  const {
    data: recentSessions,
    loading: recentSessionsLoading,
    validating: recentSessionsValidating,
    error: recentSessionsError,
  } = useApi<{
    data: SessionRow[];
    total: number;
  }>(`/api/sessions?limit=9&sortBy=started_at&sortOrder=desc${querySuffix}`);
  const {
    data: selectedSession,
    loading: selectedSessionLoading,
    validating: selectedSessionValidating,
    error: selectedSessionError,
  } = useApi<SessionDetail>(selectedId ? `/api/sessions/${selectedId}` : null, {
    immediate: Boolean(selectedId),
  });

  useEffect(() => {
    if (!selectedId && recentSessions?.data?.[0]) setSelectedId(recentSessions.data[0].id);
  }, [recentSessions, selectedId]);

  const { data: budgetStatus } = useApi<BudgetStatusItem[]>('/api/budgets/status', {
    initialData: [],
  });
  const exceededBudgets = (budgetStatus ?? []).filter(
    (b) => b.status === 'exceeded' || b.status === 'approaching',
  );

  const spendPoints = spendData?.points ?? [];
  const tokenPoints = tokenData?.points ?? [];
  const cliData = (cliBreakdown?.breakdown ?? []).filter((item) => item.value > 0);
  const modelData = (modelBreakdown?.breakdown ?? []).filter((item) => item.value > 0).slice(0, 5);
  const totalTokens = tokenPoints.reduce(
    (sum, point) => sum + point.inputTokens + point.outputTokens,
    0,
  );
  const totalDurationMs = overview?.totalDurationMs ?? 0;
  const totalMessages = overview?.totalMessages ?? 0;
  const sessionSample = recentSessions?.data ?? [];
  const actualCostCount = sessionSample.filter(
    (session) => session.cost_source === 'actual',
  ).length;
  const estimatedCostCount = sessionSample.filter(
    (session) => session.cost_source === 'estimated',
  ).length;
  const highConfidenceCount = sessionSample.filter(
    (session) => session.source_confidence === 'HIGH',
  ).length;
  const sessionsWithTools = sessionSample.filter((session) => session.tool_call_count > 0).length;
  const sampleSize = Math.max(sessionSample.length, 1);
  const costQuality: QualityTone =
    actualCostCount > 0 ? 'real' : estimatedCostCount > 0 ? 'estimated' : 'unknown';
  const tokenCoverage = tokenPoints.filter((point) => point.inputTokens + point.outputTokens > 0);
  const qualitySignals = [
    {
      label: t('dashboard.quality.cost'),
      state: costQuality,
      score: Math.round(((actualCostCount + estimatedCostCount * 0.65) / sampleSize) * 100),
      detail:
        actualCostCount > 0
          ? t('dashboard.quality.actualRows').replace('{{count}}', String(actualCostCount))
          : estimatedCostCount > 0
            ? t('dashboard.quality.estimatedRows').replace('{{count}}', String(estimatedCostCount))
            : t('dashboard.quality.noRecentCost'),
    },
    {
      label: t('dashboard.quality.tokens'),
      state: totalTokens > 0 ? ('real' as const) : ('unknown' as const),
      score:
        totalTokens > 0
          ? Math.round((tokenCoverage.length / Math.max(tokenPoints.length, 1)) * 100)
          : 0,
      detail: totalTokens > 0 ? formatTokens(totalTokens) : t('dashboard.quality.noTokenEvents'),
    },
    {
      label: t('dashboard.quality.tools'),
      state: sessionsWithTools > 0 ? ('partial' as const) : ('unknown' as const),
      score: Math.round((sessionsWithTools / sampleSize) * 100),
      detail: t('dashboard.quality.recentSessions')
        .replace('{{count}}', String(sessionsWithTools))
        .replace('{{total}}', String(sessionSample.length || 0)),
    },
    {
      label: t('dashboard.quality.confidence'),
      state: highConfidenceCount > 0 ? ('real' as const) : ('partial' as const),
      score: Math.round((highConfidenceCount / sampleSize) * 100),
      detail: t('dashboard.quality.highConfidence')
        .replace('{{count}}', String(highConfidenceCount))
        .replace('{{total}}', String(sessionSample.length || 0)),
    },
  ];

  const selectedUsage = useMemo(() => {
    const events = selectedSession?.usageEvents ?? [];
    return events.reduce(
      (acc, item) => ({
        input: acc.input + (item.input_tokens ?? 0),
        output: acc.output + (item.output_tokens ?? 0),
        cacheRead: acc.cacheRead + (item.cache_read_tokens ?? 0),
        cacheWrite: acc.cacheWrite + (item.cache_write_tokens ?? 0),
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    );
  }, [selectedSession]);

  const anyError =
    overviewError ||
    spendError ||
    tokenError ||
    cliError ||
    modelError ||
    recentSessionsError ||
    selectedSessionError;
  const isValidating =
    overviewValidating ||
    spendValidating ||
    tokenValidating ||
    cliValidating ||
    modelValidating ||
    recentSessionsValidating ||
    selectedSessionValidating;
  const rangeLabel =
    range === '7d'
      ? t('common.last7')
      : range === '90d'
        ? t('common.last90')
        : range === 'all'
          ? t('common.allTime')
          : t('common.last30');

  return (
    <div
      className="grid min-h-full grid-cols-1 gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      aria-busy={isValidating}
    >
      {anyError && (
        <section className="xl:col-span-2">
          <ErrorState
            title={t('dashboard.failed')}
            message={anyError.message}
            code={anyError.code}
            details={anyError.details}
            onRetry={() => window.location.reload()}
          />
        </section>
      )}
      <div className="flex min-w-0 flex-col gap-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpiCard
            label={t('dashboard.totalSpend')}
            value={<Sensitive>{formatCurrency(overview?.totalSpend)}</Sensitive>}
            meta={rangeLabel}
            icon={CircleDollarSign}
            tone={exceededBudgets.length > 0 ? 'warning' : 'success'}
            loading={overviewLoading}
            sub={
              overview && overview.confirmedSpend > 0 && overview.estimatedSpend > 0 ? (
                <>
                  <Sensitive>{formatCurrency(overview.confirmedSpend)}</Sensitive>{' '}
                  {t('common.actual')} ·{' '}
                  <Sensitive>{formatCurrency(overview.estimatedSpend)}</Sensitive>{' '}
                  {t('common.estimated')}
                </>
              ) : overview && overview.estimatedSpend > 0 && overview.confirmedSpend === 0 ? (
                t('common.estimated')
              ) : undefined
            }
          />
          <DashboardKpiCard
            label={t('dashboard.totalSessions')}
            value={String(overview?.sessionCount ?? 0)}
            meta={t('dashboard.indexed')}
            icon={Bot}
            tone="info"
            loading={overviewLoading}
          />
          <DashboardKpiCard
            label={t('dashboard.totalTokens')}
            value={formatTokens(totalTokens)}
            meta={t('dashboard.allSources')}
            icon={Network}
            tone="info"
            loading={tokenLoading && !tokenData}
          />
          <DashboardKpiCard
            label={t('dashboard.avgCostSession')}
            value={<Sensitive>{formatCurrency(overview?.averageSessionCost)}</Sensitive>}
            meta={overview?.mostUsedCli ?? t('common.unknown')}
            icon={Gauge}
            tone="warning"
            loading={overviewLoading}
          />
        </section>

        {exceededBudgets.length > 0 && (
          <div className="grid gap-2">
            {exceededBudgets.slice(0, 3).map((b) => (
              <AlertStrip
                key={`${b.id}-${b.scope_type}-${b.scope_value}`}
                tone={b.status === 'exceeded' ? 'danger' : 'warning'}
                icon={ShieldAlert}
                title={
                  b.status === 'exceeded'
                    ? t('budget.status.exceeded')
                    : t('budget.status.approaching')
                }
                description={
                  <>
                    {b.scope_value ?? t('budget.scope.global')} ({t(`budget.period.${b.period}`)}):{' '}
                    <span className="font-mono font-medium text-foreground">
                      ${b.current_spend.toFixed(2)}
                    </span>{' '}
                    / <span className="font-mono text-foreground">${b.limit_usd.toFixed(2)}</span>
                  </>
                }
                badge={`${b.percentage.toFixed(0)}%`}
                action={
                  <Link to="/budgets">
                    <Button variant="outline" size="sm">
                      {t('nav.budgets')}
                    </Button>
                  </Link>
                }
              />
            ))}
            {exceededBudgets.length > 3 && (
              <Link to="/budgets" className="text-center text-xs text-accent hover:underline">
                +{exceededBudgets.length - 3} {t('budget.alerts.more')}
              </Link>
            )}
          </div>
        )}

        <section className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(190px,0.55fr)_minmax(190px,0.55fr)]">
          <FigurePanel
            figure="FIG. 01"
            title={t('project.spendOverTime')}
            description={t('dashboard.spendTrendDescription')}
            meta={<Badge variant="neutral">{rangeLabel}</Badge>}
            contentClassName="pt-4"
          >
            {spendLoading && !spendData ? (
              <ChartSkeleton />
            ) : (
              <div className="sensitive">
                <ResponsiveContainer width="100%" height={330}>
                  <AreaChart data={spendPoints}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
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
                      tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => [formatCurrency(value), t('common.cost')]}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="var(--accent)"
                      fill="url(#spendGradient)"
                      strokeWidth={2.4}
                      dot={{ r: 3, fill: 'var(--accent)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </FigurePanel>

          <FigurePanel
            figure="PULSE"
            className="xl:col-span-2"
            title={t('dashboard.graphQuality')}
            description={t('dashboard.graphQualityDescription')}
            meta={
              <Badge variant={isValidating ? 'warning' : 'success'}>
                {isValidating ? t('common.loading') : t('dashboard.live')}
              </Badge>
            }
            contentClassName="space-y-3"
          >
            <QualitySignalGrid items={qualitySignals} />
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
              <InlineFact
                label={t('dashboard.totalDuration')}
                value={formatDuration(totalDurationMs)}
              />
              <InlineFact label={t('common.messages')} value={formatTokens(totalMessages)} />
            </div>
          </FigurePanel>

          <FigurePanel
            figure="FIG. 02"
            title={t('dashboard.tokenFlow')}
            description={t('dashboard.tokenFlowDescription')}
            meta={<Badge variant="neutral">{formatTokens(totalTokens)}</Badge>}
            contentClassName="pt-4"
          >
            {tokenLoading && !tokenData ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={tokenPoints}>
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
                    tickFormatter={(value: number) => formatTokens(value)}
                  />
                  <Tooltip
                    {...chartTooltipProps}
                    formatter={(value: number, name: string) => [formatTokens(value), name]}
                  />
                  <Area
                    type="monotone"
                    dataKey="inputTokens"
                    name={t('common.input')}
                    stroke="var(--info)"
                    fill="var(--info-soft)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="outputTokens"
                    name={t('common.output')}
                    stroke="var(--success)"
                    fill="var(--success-soft)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </FigurePanel>

          <DonutCard
            figure="FIG. 03"
            title={t('dashboard.spendByCli')}
            data={cliData}
            center={<Sensitive>{formatCurrency(overview?.totalSpend)}</Sensitive>}
            centerLabel={t('common.total')}
            emptyTitle={t('dashboard.noSpend.title')}
            emptyDescription={t('dashboard.noSpend.description')}
            loading={cliLoading && !cliBreakdown}
            colorFor={(label, index) => CLI_COLORS[label] ?? chartColor(index)}
          />
          <DonutCard
            figure="FIG. 04"
            title={t('dashboard.spendByModel')}
            data={modelData}
            center={`${modelData.length}`}
            centerLabel={t('dashboard.modelsLabel')}
            emptyTitle={t('dashboard.noSpend.title')}
            emptyDescription={t('dashboard.noSpend.description')}
            loading={modelLoading && !modelBreakdown}
            colorFor={(_, index) => chartColor(index)}
          />

          <FigurePanel
            figure="LEDGER 01"
            className="overflow-hidden xl:col-span-3"
            title={t('dashboard.recentSessions')}
            description={t('dashboard.recentSessionsDescription')}
            action={
              <Link
                to="/sessions"
                className="inline-flex items-center justify-end gap-2 rounded-sm font-mono text-xs font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
              >
                {t('dashboard.viewAllSessions')} <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
            contentClassName="p-0"
          >
            <DataTableContainer className="max-h-[560px] overflow-auto">
              <DataTable density="compact">
                <DataTableHead className="sticky top-0 z-10 bg-surface">
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHeaderCell>{t('common.session')}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t('common.cli')}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t('common.model')}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t('common.project')}</DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      {t('common.activity')}
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      {t('common.cost')}
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      {t('common.time')}
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="w-10" />
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {recentSessionsLoading && !recentSessions ? (
                    <TableSkeletonRows rows={8} columns={8} />
                  ) : (
                    (recentSessions?.data ?? []).map((session) => (
                      <DataTableRow
                        key={session.id}
                        onClick={() => navigate(`/sessions/${session.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/sessions/${session.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={t('dashboard.openSession')}
                        className="cursor-pointer"
                      >
                        <DataTableCell>
                          <div className="flex items-center gap-3">
                            <BrandMark value={session.cli} size="sm" />
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {session.session_id.slice(0, 8)}
                              </div>
                              <div className="text-xs text-subtle-foreground">
                                {session.provider}
                              </div>
                            </div>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <BrandBadge value={session.cli} />
                        </DataTableCell>
                        <DataTableCell className="font-mono text-xs text-muted-foreground">
                          {session.model ?? t('common.unknown')}
                        </DataTableCell>
                        <DataTableCell className="max-w-[220px] truncate text-muted-foreground">
                          {compactPath(session.project_path)}
                        </DataTableCell>
                        <DataTableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          <div>{formatDuration(session.duration_ms)}</div>
                          <div className="text-[10px] uppercase text-subtle-foreground">
                            {session.message_count} {t('common.messagesShort')} /{' '}
                            {session.tool_call_count} {t('common.tools').toLowerCase()}
                          </div>
                        </DataTableCell>
                        <DataTableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                          <div>
                            <Sensitive>{formatCurrency(session.total_cost_usd)}</Sensitive>
                          </div>
                          {session.cost_source === 'estimated' && (
                            <Badge variant="estimated" className="mt-1">
                              {t('common.estimated')}
                            </Badge>
                          )}
                        </DataTableCell>
                        <DataTableCell className="text-right text-muted-foreground">
                          {formatRelativeTime(session.started_at)}
                        </DataTableCell>
                        <DataTableCell className="text-right">
                          <MoreHorizontal className="h-4 w-4 text-subtle-foreground" />
                        </DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>
            </DataTableContainer>
          </FigurePanel>
        </section>
      </div>

      <aside className="space-y-4 xl:self-start">
        {selectedSessionLoading && !selectedSession ? (
          <PanelSkeleton className="h-full min-h-[520px]" />
        ) : (
          <Card variant="figure" className="overflow-hidden">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {t('dashboard.sessionInspector')}
                  </h2>
                  <p className="mt-3 text-[11px] font-semibold uppercase text-subtle-foreground">
                    {t('common.session')}
                  </p>
                </div>
                <Badge
                  variant={
                    selectedSession?.source_confidence === 'HIGH'
                      ? 'success'
                      : selectedSession?.source_confidence === 'MEDIUM'
                        ? 'default'
                        : 'warning'
                  }
                >
                  {selectedSession?.source_confidence
                    ? t(`common.confidence.${selectedSession.source_confidence.toLowerCase()}`)
                    : '—'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 py-2">
                <BrandMark value={selectedSession?.cli} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-semibold text-foreground">
                    {selectedSession?.session_id?.slice(0, 8) ?? t('common.session')}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {getBrandMeta(selectedSession?.cli).label} ·{' '}
                    {selectedSession?.model ?? t('common.unknown')}
                  </p>
                </div>
              </div>

              {selectedSessionError ? (
                <ErrorState
                  title={
                    selectedSessionError.status === 404
                      ? t('session.notFound')
                      : t('session.unable')
                  }
                  message={selectedSessionError.message}
                  code={selectedSessionError.code}
                  details={selectedSessionError.details}
                  onRetry={() => selectedId && setSelectedId(selectedId)}
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border">
                    <InspectorStat
                      label={t('common.cost')}
                      value={
                        <Sensitive>{formatCurrency(selectedSession?.total_cost_usd)}</Sensitive>
                      }
                      meta={
                        selectedSession
                          ? t(`common.${selectedSession.cost_source}`)
                          : t('common.unknown')
                      }
                    />
                    <InspectorStat
                      label={t('common.tokens')}
                      value={formatTokens(selectedUsage.input + selectedUsage.output)}
                      meta={t('dashboard.allSources')}
                    />
                    <InspectorStat
                      label={t('common.tools')}
                      value={String(selectedSession?.tool_call_count ?? 0)}
                      meta={t('analytics.totalAcrossSessions')}
                    />
                    <InspectorStat
                      label={t('common.messages')}
                      value={String(selectedSession?.message_count ?? 0)}
                      meta={t('common.messages').toLowerCase()}
                    />
                    <InspectorStat
                      label={t('common.duration')}
                      value={formatDuration(selectedSession?.duration_ms)}
                      meta={t('common.activity')}
                      className="col-span-2"
                    />
                  </div>

                  <div className="rounded-md border border-border bg-surface p-3">
                    <div className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">
                      {t('session.tokenUsage')}
                    </div>
                    <TokenUsageBar
                      input={selectedUsage.input}
                      output={selectedUsage.output}
                      cacheRead={selectedUsage.cacheRead}
                      cacheWrite={selectedUsage.cacheWrite}
                    />
                  </div>

                  <div className="rounded-md border border-border bg-surface p-3 text-sm">
                    <div className="mb-3 text-[11px] font-semibold uppercase text-muted-foreground">
                      {t('session.metadata')}
                    </div>
                    <InfoRow
                      label={t('common.project')}
                      value={basename(selectedSession?.project_path)}
                    />
                    <InfoRow
                      label={t('common.provider')}
                      value={selectedSession?.provider ?? '—'}
                    />
                    <InfoRow
                      label={t('common.model')}
                      value={selectedSession?.model ?? t('common.unknown')}
                    />
                    <InfoRow
                      label={t('common.started')}
                      value={
                        selectedSession?.started_at ? formatDate(selectedSession.started_at) : '—'
                      }
                    />
                    <InfoRow
                      label={t('common.ended')}
                      value={selectedSession?.ended_at ? formatDate(selectedSession.ended_at) : '—'}
                    />
                    <InfoRow
                      label={t('common.duration')}
                      value={formatDuration(selectedSession?.duration_ms)}
                    />
                  </div>
                </>
              )}

              {selectedId && (
                <Link to={`/sessions/${selectedId}`}>
                  <Button variant="outline" className="w-full">
                    {t('dashboard.openSession')} <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}

const kpiToneClasses: Record<QualityTone | 'success' | 'warning' | 'info', string> = {
  real: 'border-success/25 bg-success-soft text-success',
  partial: 'border-warning/25 bg-warning-soft text-warning',
  estimated: 'border-info/25 bg-info-soft text-info',
  unknown: 'border-border bg-surface-muted text-muted-foreground',
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  info: 'border-info/25 bg-info-soft text-info',
};

function DashboardKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
  loading,
  sub,
}: {
  label: string;
  value: ReactNode;
  meta: string;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'info';
  loading?: boolean;
  sub?: ReactNode;
}) {
  return (
    <Card variant="figure" className="overflow-hidden">
      <CardContent className="min-h-[142px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-full border ${kpiToneClasses[tone]}`}
          >
            <Icon className="size-5" />
          </div>
          <Badge variant="neutral" className="max-w-[140px] truncate">
            {meta}
          </Badge>
        </div>
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="mt-3 truncate font-mono text-3xl font-semibold leading-none text-foreground tabular-nums">
            {loading ? '...' : value}
          </div>
          {sub && <div className="mt-1.5 truncate text-[11px] text-subtle-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function QualitySignalGrid({
  items,
}: {
  items: { label: string; state: QualityTone; score: number; detail?: string }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <QualitySignalCard key={item.label} item={item} />
      ))}
    </div>
  );
}

function QualitySignalCard({
  item,
}: {
  item: { label: string; state: QualityTone; score: number; detail?: string };
}) {
  const score = Math.max(0, Math.min(100, Number.isFinite(item.score) ? item.score : 0));

  return (
    <div className="min-h-[92px] rounded-md border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase text-subtle-foreground">
            {item.label}
          </div>
          {item.detail ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</div>
          ) : null}
        </div>
        <Badge variant={item.state}>{item.state}</Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="shrink-0">
          <span className="font-mono text-2xl font-semibold leading-none text-foreground">
            {score}
          </span>
          <span className="ml-1 font-mono text-xs text-subtle-foreground">/100</span>
        </div>
        <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={
              item.state === 'partial'
                ? 'h-full rounded-full bg-warning'
                : 'h-full rounded-full bg-accent'
            }
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-semibold uppercase text-subtle-foreground">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function InspectorStat({
  label,
  value,
  meta,
  className,
}: {
  label: string;
  value: ReactNode;
  meta: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 border-b border-r border-border p-3 last:border-b-0 ${className ?? ''}`}
    >
      <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
      <div className="mt-2 truncate font-mono text-sm font-semibold text-foreground">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{meta}</div>
    </div>
  );
}

function DonutCard({
  figure,
  title,
  data,
  center,
  centerLabel,
  emptyTitle,
  emptyDescription,
  loading,
  colorFor,
}: {
  figure: string;
  title: string;
  data: { label: string; value: number; percentage: number }[];
  center: ReactNode;
  centerLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  colorFor: (label: string, index: number) => string;
}) {
  const { t } = useI18n();

  return (
    <FigurePanel
      figure={figure}
      className="h-full min-h-[300px]"
      title={title}
      description={t('dashboard.topContributors')}
      contentClassName="grid min-h-[244px] grid-rows-[132px_1fr] gap-3 pt-3"
    >
      {loading ? (
        <DonutSkeleton className="contents" />
      ) : (
        <>
          <div className="relative mx-auto h-32 w-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={62}
                  paddingAngle={2}
                  stroke="var(--background)"
                  strokeWidth={3}
                >
                  {data.map((item, index) => (
                    <Cell key={item.label} fill={colorFor(item.label, index)} />
                  ))}
                </Pie>
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(value: number) => [formatCurrency(value), t('common.cost')]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-base font-semibold text-foreground">{center}</div>
                <div className="text-[10px] uppercase text-subtle-foreground">{centerLabel}</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {data.map((item, index) => (
              <div
                key={item.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: colorFor(item.label, index) }}
                  />
                  <span className="break-words leading-snug text-muted-foreground">
                    {item.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="hidden text-subtle-foreground 2xl:inline">
                    <Sensitive>{formatCurrency(item.value)}</Sensitive>
                  </span>
                  <span className="min-w-12 text-right font-mono font-semibold text-foreground">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <EmptyState title={emptyTitle} description={emptyDescription} className="p-4" />
            )}
          </div>
        </>
      )}
    </FigurePanel>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 flex justify-between gap-4 last:mb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}
