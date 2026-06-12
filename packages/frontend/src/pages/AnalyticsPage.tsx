import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CircleDollarSign,
  Coins,
  Database,
  Download,
  Gauge,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import { compactPath, formatCurrency, formatTokens } from '../lib/format.js';
import { chartColor } from '../lib/chart-colors.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { BrandBadge, getBrandMeta } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { ControlField } from '../components/ui/ControlField.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import { ChartSkeleton, DonutSkeleton } from '../components/ui/LoadingState.js';
import { chartTooltipProps } from '../components/ui/ChartTooltip.js';
import { Select } from '../components/ui/Select.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

interface Insight {
  id: string;
  kind: 'growth' | 'project' | 'model' | 'session' | 'cache';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
  sessionId?: string;
}

interface Anomaly {
  id: string;
  kind: 'spend' | 'token' | 'session';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
  sessionId?: string;
}

interface InsightPreviewState {
  insightPreview: {
    id: string;
    kind: string;
    type: 'insight' | 'anomaly';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    value: string;
    sessionId?: string;
  };
}

interface AnalyticsReport {
  generatedAt: string;
  summary: {
    totalSpend: number;
    current7DaySpend: number;
    previous7DaySpend: number;
    growthPercent: number | null;
    baselineDailySpend: number;
  };
  insights: Insight[];
  anomalies: Anomaly[];
  trend: { date: string; spend: number }[];
  productivity: {
    totalToolCalls: number;
    avgFilesPerSession: number;
    avgToolCallsPerSession: number;
    avgToolCallsPerMinute: number | null;
    avgTokensPerToolCall: number | null;
    avgCostPerToolCall: number | null;
    avgMessagesPerToolCall: number | null;
    costToolCallCorrelation: number | null;
    topToolCallSessions: {
      sessionId: string;
      cli: string;
      provider: string;
      model: string | null;
      projectPath: string | null;
      cost: number;
      durationMs: number | null;
      messages: number;
      toolCalls: number;
      tokens: number;
      toolCallsPerMinute: number | null;
      tokensPerToolCall: number | null;
      costPerToolCall: number | null;
      messagesPerToolCall: number | null;
    }[];
    filesModifiedSupported: boolean;
    notes: string[];
  };
  modelUsageBreakdown: {
    provider: string;
    model: string;
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    toolCallsCount: number;
    totalCostUsd: number;
  }[];
}

interface FilterOption {
  label: string;
  value: string;
  count: number;
}
interface FilterOptionsResponse {
  clis: FilterOption[];
  providers: FilterOption[];
  models: FilterOption[];
  projects: FilterOption[];
}

export function AnalyticsPage() {
  const { t, locale } = useI18n();
  const { queryString } = useDateRange();
  const [dimension, setDimension] = useState('model');
  const [metric, setMetric] = useState('cost');
  const [cliFilter, setCliFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [spendGranularity, setSpendGranularity] = useState<'day' | 'week' | 'month'>('week');
  const [trendMetric, setTrendMetric] = useState<'cost' | 'tokens'>('cost');

  const setDimensionFilter = (label: string) => {
    switch (dimension) {
      case 'model':
        setModelFilter(modelFilter === label ? '' : label);
        break;
      case 'provider':
        setProviderFilter(providerFilter === label ? '' : label);
        break;
      case 'cli':
        setCliFilter(cliFilter === label ? '' : label);
        break;
      case 'project':
        setProjectFilter(projectFilter === label ? '' : label);
        break;
    }
  };
  const filterParams = new URLSearchParams(queryString);
  if (cliFilter) filterParams.set('cli', cliFilter);
  if (providerFilter) filterParams.set('provider', providerFilter);
  if (modelFilter) filterParams.set('model', modelFilter);
  if (projectFilter) filterParams.set('project', projectFilter);
  const filteredQuery = filterParams.toString();
  const filteredPrefix = filteredQuery ? `?${filteredQuery}` : '';
  const filteredSuffix = filteredQuery ? `&${filteredQuery}` : '';

  const filterOptionsParams = new URLSearchParams(queryString);
  if (cliFilter) filterOptionsParams.set('cli', cliFilter);
  if (providerFilter) filterOptionsParams.set('provider', providerFilter);
  if (modelFilter) filterOptionsParams.set('model', modelFilter);
  if (projectFilter) filterOptionsParams.set('project', projectFilter);
  const filterOptionsQuery = filterOptionsParams.toString();

  const { data: options } = useApi<FilterOptionsResponse>(
    `/api/analytics/filter-options${filterOptionsQuery ? `?${filterOptionsQuery}` : ''}`,
    { initialData: { clis: [], providers: [], models: [], projects: [] } },
  );
  const {
    data: report,
    loading: reportLoading,
    validating: reportValidating,
    error: reportError,
  } = useApi<AnalyticsReport>(`/api/analytics/report${filteredPrefix}`);
  const {
    data: spendData,
    loading: spendLoading,
    validating: spendValidating,
    error: spendError,
  } = useApi<{
    points: { date: string; spend: number; tokens: number }[];
  }>(`/api/analytics/spend-over-time?granularity=${spendGranularity}${filteredSuffix}`);
  const {
    data: tokenData,
    validating: tokenValidating,
    error: tokenError,
  } = useApi<{
    points: { date: string; inputTokens: number; outputTokens: number }[];
  }>(`/api/analytics/tokens-over-time${filteredPrefix}`);
  const {
    data: breakdownData,
    loading: breakdownLoading,
    validating: breakdownValidating,
    error: breakdownError,
  } = useApi<{
    breakdown: { label: string; value: number; percentage: number }[];
  }>(`/api/analytics/breakdown?dimension=${dimension}&metric=${metric}${filteredSuffix}`);
  const isValidating =
    reportValidating || spendValidating || tokenValidating || breakdownValidating;

  const dimensionLabel =
    dimension === 'model'
      ? t('analytics.byModel')
      : dimension === 'provider'
        ? t('analytics.byProvider')
        : dimension === 'cli'
          ? t('analytics.byCli')
          : t('analytics.byProject');
  const metricLabel =
    metric === 'cost'
      ? t('common.cost')
      : metric === 'sessions'
        ? t('common.sessions')
        : t('common.tokens');
  const breakdownTitle = t('analytics.topBreakdown')
    .replace('{{dimension}}', dimensionLabel)
    .replace('{{metric}}', metricLabel);

  const breakdown = useMemo(
    () => (breakdownData?.breakdown ?? []).filter((d) => d.value > 0),
    [breakdownData],
  );
  const insights = report?.insights ?? [];
  const anomalies = report?.anomalies ?? [];
  const productivity = report?.productivity;
  const modelUsage = report?.modelUsageBreakdown ?? [];
  const spendPoints = spendData?.points ?? report?.trend ?? [];
  const tokenTrendTotal = (tokenData?.points ?? []).reduce(
    (sum, point) => sum + point.inputTokens + point.outputTokens,
    0,
  );
  const totalModelCost = modelUsage.reduce((sum, item) => sum + item.totalCostUsd, 0);
  const totalModelTokens = modelUsage.reduce(
    (sum, item) => sum + item.inputTokens + item.outputTokens + item.reasoningTokens,
    0,
  );
  const topInsights = insights.slice(0, 3);
  const topAnomalies = anomalies.slice(0, 2);
  const topToolSessions = productivity?.topToolCallSessions ?? [];
  const topModels = modelUsage.slice(0, 6);
  const activeFilters = [
    cliFilter
      ? {
          key: 'cli',
          label: `${t('common.cli')}: ${getBrandLabel(cliFilter)}`,
          clear: () => setCliFilter(''),
        }
      : null,
    providerFilter
      ? {
          key: 'provider',
          label: `${t('common.provider')}: ${providerFilter}`,
          clear: () => setProviderFilter(''),
        }
      : null,
    modelFilter
      ? {
          key: 'model',
          label: `${t('common.model')}: ${modelFilter}`,
          clear: () => setModelFilter(''),
        }
      : null,
    projectFilter
      ? {
          key: 'project',
          label: `${t('common.project')}: ${compactPath(projectFilter)}`,
          clear: () => setProjectFilter(''),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-5 p-4 lg:p-6" aria-busy={isValidating}>
      {(reportError || spendError || tokenError || breakdownError) && (
        <ErrorState
          title={t('analytics.failed')}
          message={
            reportError?.message ||
            spendError?.message ||
            tokenError?.message ||
            breakdownError?.message ||
            t('analytics.failed.message')
          }
          code={reportError?.code || spendError?.code || tokenError?.code || breakdownError?.code}
          details={
            reportError?.details ||
            spendError?.details ||
            tokenError?.details ||
            breakdownError?.details
          }
          onRetry={() => window.location.reload()}
        />
      )}

      <Card variant="figure" className="overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <ControlField label={t('analytics.groupBy')}>
              <Select
                className="h-10 text-[13px]"
                options={[
                  { label: t('analytics.byModel'), value: 'model' },
                  { label: t('analytics.byProvider'), value: 'provider' },
                  { label: t('analytics.byCli'), value: 'cli' },
                  { label: t('analytics.byProject'), value: 'project' },
                ]}
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
              />
            </ControlField>
            <ControlField label={t('analytics.metric')}>
              <Select
                className="h-10 text-[13px]"
                options={[
                  { label: t('common.cost'), value: 'cost' },
                  { label: t('common.sessions'), value: 'sessions' },
                  { label: t('common.tokens'), value: 'tokens' },
                ]}
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              />
            </ControlField>
            <ControlField label={t('common.cli')}>
              <Select
                className="h-10 text-[13px]"
                value={cliFilter}
                onChange={(e) => setCliFilter(e.target.value)}
                options={[
                  { label: t('analytics.allClis'), value: '' },
                  ...(options?.clis ?? []).map((item) => ({
                    label: `${item.label} (${item.count})`,
                    value: item.value,
                  })),
                ]}
              />
            </ControlField>
            <ControlField label={t('common.provider')}>
              <Select
                className="h-10 text-[13px]"
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                options={[
                  { label: t('analytics.allProviders'), value: '' },
                  ...(options?.providers ?? []).map((item) => ({
                    label: `${item.label} (${item.count})`,
                    value: item.value,
                  })),
                ]}
              />
            </ControlField>
            <ControlField label={t('common.model')}>
              <Select
                className="h-10 text-[13px]"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                options={[
                  { label: t('analytics.allModels'), value: '' },
                  ...(options?.models ?? []).map((item) => ({
                    label: `${item.label} (${item.count})`,
                    value: item.value,
                  })),
                ]}
              />
            </ControlField>
            <ControlField label={t('common.project')}>
              <Select
                className="h-10 text-[13px]"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                options={[
                  { label: t('analytics.allProjects'), value: '' },
                  ...(options?.projects ?? []).map((item) => ({
                    label: `${compactPath(item.label)} (${item.count})`,
                    value: item.value,
                  })),
                ]}
              />
            </ControlField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.clear}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <span>{filter.label}</span>
                  <span className="text-subtle-foreground">x</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(cliFilter || providerFilter || modelFilter || projectFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCliFilter('');
                    setProviderFilter('');
                    setModelFilter('');
                    setProjectFilter('');
                  }}
                >
                  {t('analytics.clearFilters')}
                </Button>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t('common.refresh')}
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionHeader
        title={t('analytics.summaryTitle')}
        description={t('analytics.summaryDescription')}
        action={
          <Button variant="outline" size="sm">
            {t('analytics.exportReport')} <Download className="h-4 w-4" />
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <AnalyticsKpiCard
          icon={CircleDollarSign}
          label={t('dashboard.totalSpend')}
          value={formatCurrency(report?.summary.totalSpend)}
          meta={
            report?.summary.growthPercent != null
              ? `${report.summary.growthPercent >= 0 ? '+' : ''}${report.summary.growthPercent.toFixed(1)}% ${t('analytics.vsPriorWeek')}`
              : t('analytics.notEnoughData')
          }
          tone="success"
          loading={reportLoading && !report}
        />
        <AnalyticsKpiCard
          icon={TrendingUp}
          label={t('analytics.baselineDay')}
          value={formatCurrency(report?.summary.baselineDailySpend)}
          meta={t('analytics.movingBaseline')}
          tone="info"
          loading={reportLoading && !report}
        />
        <AnalyticsKpiCard
          icon={Lightbulb}
          label={t('analytics.insights')}
          value={String(insights.length)}
          meta={t('analytics.actionableFindings')}
          tone="info"
          loading={reportLoading && !report}
        />
        <AnalyticsKpiCard
          icon={AlertTriangle}
          label={t('analytics.anomalies')}
          value={String(anomalies.length)}
          meta={t('analytics.outliers')}
          tone="warning"
          loading={reportLoading && !report}
        />
        <AnalyticsKpiCard
          icon={Wrench}
          label={t('analytics.toolCalls')}
          value={String(productivity?.totalToolCalls ?? 0)}
          meta={t('analytics.totalAcrossSessions')}
          tone="danger"
          loading={reportLoading && !report}
        />
        <AnalyticsKpiCard
          icon={Database}
          label={t('analytics.tokensTool')}
          value={formatTokens(productivity?.avgTokensPerToolCall)}
          meta={`${formatTokens(tokenTrendTotal)} ${t('common.total').toLowerCase()}`}
          tone="success"
          loading={reportLoading && !report}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
        <FigurePanel
          figure="FIG. 01"
          title={t('analytics.spendUsageTitle')}
          description={t('analytics.spendUsageDescription')}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="h-9 text-xs"
                value={spendGranularity}
                onChange={(e) => setSpendGranularity(e.target.value as 'day' | 'week' | 'month')}
                options={[
                  { label: t('analytics.granularityDay'), value: 'day' },
                  { label: t('analytics.granularityWeek'), value: 'week' },
                  { label: t('analytics.granularityMonth'), value: 'month' },
                ]}
              />
              <div className="inline-flex rounded-md border border-border bg-surface p-1">
                <Button
                  variant={trendMetric === 'cost' ? 'subtle' : 'quiet'}
                  size="sm"
                  onClick={() => setTrendMetric('cost')}
                >
                  {t('common.cost')}
                </Button>
                <Button
                  variant={trendMetric === 'tokens' ? 'subtle' : 'quiet'}
                  size="sm"
                  onClick={() => setTrendMetric('tokens')}
                >
                  {t('common.tokens')}
                </Button>
              </div>
            </div>
          }
        >
          {spendLoading && !spendData && !report ? (
            <ChartSkeleton className="h-[390px]" />
          ) : (
            <ResponsiveContainer width="100%" height={390}>
              <AreaChart data={spendPoints}>
                <defs>
                  <linearGradient id="analyticsSpendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="analyticsTokenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--info)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--info)" stopOpacity={0.02} />
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
                  yAxisId="cost"
                  tick={{ fontSize: 11, fill: 'var(--success)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <YAxis
                  yAxisId="tokens"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'var(--info)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatTokens(v)}
                />
                <Tooltip
                  {...chartTooltipProps}
                  formatter={(value: number, name: string) => [
                    name === 'tokens' ? formatTokens(value) : formatCurrency(value),
                    name === 'tokens' ? t('common.tokens') : t('common.cost'),
                  ]}
                />
                <Area
                  yAxisId="cost"
                  type="monotone"
                  dataKey="spend"
                  stroke="var(--accent)"
                  fill="url(#analyticsSpendGradient)"
                  strokeWidth={2.4}
                  dot={{ r: 3, fill: 'var(--accent)' }}
                  opacity={trendMetric === 'cost' ? 1 : 0.45}
                />
                <Area
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="tokens"
                  stroke="var(--info)"
                  fill="url(#analyticsTokenGradient)"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: 'var(--info)' }}
                  opacity={trendMetric === 'tokens' ? 1 : 0.45}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </FigurePanel>

        <div className="grid gap-4">
          <SideListPanel
            title={t('analytics.insightsTop')}
            actionLabel={t('common.viewAll')}
            emptyTitle={t('analytics.noInsights.title')}
            emptyDescription={t('analytics.noInsights.description')}
          >
            {topInsights.map((insight) => {
              const localized = localizeInsight(insight, locale);
              return (
                <InsightLinkCard
                  key={insight.id}
                  item={localized}
                  original={insight}
                  type="insight"
                />
              );
            })}
          </SideListPanel>

          <SideListPanel
            title={t('analytics.anomaliesTitle')}
            actionLabel={t('common.viewAll')}
            emptyTitle={t('analytics.noAnomalies.title')}
            emptyDescription={t('analytics.noAnomalies.description')}
          >
            {topAnomalies.map((anomaly) => {
              const localized = localizeAnomaly(anomaly, locale);
              return (
                <InsightLinkCard
                  key={anomaly.id}
                  item={localized}
                  original={anomaly}
                  type="anomaly"
                />
              );
            })}
          </SideListPanel>
        </div>
      </div>

      <SectionHeader
        title={t('analytics.breakdown')}
        description={t('analytics.breakdownDescription')}
      />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.92fr_1.08fr]">
        <FigurePanel
          figure="FIG. 02"
          title={t('analytics.modelDistribution')}
          description={dimensionLabel}
        >
          {breakdownLoading && !breakdownData ? (
            <DonutSkeleton className="min-h-[280px]" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
              <div className="relative mx-auto h-56 w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={96}
                      innerRadius={62}
                      onClick={(data: { name: string }) => setDimensionFilter(data.name)}
                      className="cursor-pointer"
                    >
                      {breakdown.map((_, i) => (
                        <Cell key={i} fill={chartColor(i)} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: number) => [
                        metric === 'cost' ? formatCurrency(value) : formatTokens(value),
                        '',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <div className="font-mono text-xl font-semibold text-foreground">
                      {metric === 'cost'
                        ? formatCurrency(totalModelCost)
                        : formatTokens(totalModelTokens)}
                    </div>
                    <div className="text-[10px] uppercase text-subtle-foreground">
                      {t('common.total')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {breakdown.slice(0, 6).map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setDimensionFilter(item.label)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: chartColor(index) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {item.label}
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {item.percentage}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </FigurePanel>

        <FigurePanel
          figure="FIG. 03"
          title={breakdownTitle}
          description={t('analytics.topProjectsDescription')}
        >
          {breakdownLoading && !breakdownData ? (
            <ChartSkeleton className="h-[280px]" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={breakdown.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (metric === 'cost' ? formatCurrency(v) : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                  width={80}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip {...chartTooltipProps} />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  onClick={(data: { label: string }) => setDimensionFilter(data.label)}
                  className="cursor-pointer"
                >
                  {breakdown.slice(0, 8).map((_, index) => (
                    <Cell key={index} fill={chartColor(index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </FigurePanel>
      </div>

      <SectionHeader
        title={t('analytics.productivityTitle')}
        description={t('analytics.productivityDescription')}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card variant="figure" className="overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>{t('analytics.productivity')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MetricLine
              label={t('analytics.avgToolCallsMinute')}
              value={formatNumber(productivity?.avgToolCallsPerMinute)}
            />
            <MetricLine
              label={t('analytics.avgMessagesToolCall')}
              value={formatNumber(productivity?.avgMessagesPerToolCall)}
            />
            <MetricLine
              label={t('analytics.avgCostToolCall')}
              value={formatCurrency(productivity?.avgCostPerToolCall)}
            />
            <MetricLine
              label={t('analytics.filesModifiedSession')}
              value={formatNumber(productivity?.avgFilesPerSession)}
              muted={!productivity?.filesModifiedSupported}
            />
            <div className="border-t border-border p-4">
              <Button variant="outline" size="sm">
                {t('analytics.fullReport')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <FigurePanel
          figure="FIG. 04"
          title={t('analytics.topToolSessions')}
          description={t('analytics.topToolSessionsDescription')}
          action={
            <Link
              to="/sessions"
              className="text-xs font-medium text-accent hover:text-accent-hover"
            >
              {t('common.viewAll')}
            </Link>
          }
        >
          {topToolSessions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {topToolSessions.slice(0, 4).map((session, index) => (
                <ToolSessionCard
                  key={session.sessionId}
                  session={session}
                  color={chartColor(index)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('analytics.noProductivity.title')}
              description={t('analytics.noProductivity.description')}
              icon={Sparkles}
            />
          )}
        </FigurePanel>
      </div>

      <SectionHeader
        title={t('analytics.modelUsageTitle')}
        description={t('analytics.multiModelDescription')}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {topModels.length > 0 ? (
            topModels.map((item, index) => (
              <ModelUsageCard
                key={`${item.provider}/${item.model}`}
                item={item}
                color={chartColor(index)}
                onClick={() => {
                  setProviderFilter(providerFilter === item.provider ? '' : item.provider);
                  setModelFilter(modelFilter === item.model ? '' : item.model);
                }}
              />
            ))
          ) : (
            <EmptyState
              title={t('analytics.noMultiModel.title')}
              description={t('analytics.noMultiModel.description')}
              icon={Sparkles}
            />
          )}
        </div>

        <Card variant="figure" className="overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <div>
              <CardTitle>{t('analytics.multiModelNotes')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.multiModelNotesDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InterpretationNote
              icon={Gauge}
              title={t('analytics.noteStable.title')}
              body={t('analytics.noteStable.body')}
              tone="success"
            />
            <InterpretationNote
              icon={Coins}
              title={t('analytics.noteCost.title')}
              body={t('analytics.noteCost.body')}
              tone="info"
            />
            <InterpretationNote
              icon={AlertTriangle}
              title={t('analytics.noteAnomaly.title')}
              body={t('analytics.noteAnomaly.body')}
              tone="warning"
            />
            <div className="rounded-md border border-border bg-surface p-3 text-xs text-subtle-foreground">
              {productivity?.notes?.[0] ?? t('analytics.filesNote')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AnalyticsKpiCard({
  icon: Icon,
  label,
  value,
  meta,
  tone,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  loading?: boolean;
}) {
  const toneClass = {
    success: 'border-success/20 bg-success-soft text-success',
    info: 'border-info/20 bg-info-soft text-info',
    warning: 'border-warning/20 bg-warning-soft text-warning',
    danger: 'border-danger/20 bg-danger-soft text-danger',
  }[tone];

  return (
    <Card variant="figure" className="overflow-hidden">
      <CardContent className="min-h-[154px] p-4">
        <div className={`grid size-9 place-items-center rounded-full border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-5 text-[11px] font-semibold uppercase text-muted-foreground">
          {label}
        </div>
        <div className="mt-3 truncate font-mono text-3xl font-semibold leading-none text-foreground">
          {loading ? '...' : value}
        </div>
        <div className="mt-3 truncate text-xs text-muted-foreground">{meta}</div>
      </CardContent>
    </Card>
  );
}

function SideListPanel({
  title,
  actionLabel,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  actionLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <Card variant="figure" className="overflow-hidden">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex w-full items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-xs font-medium text-accent">{actionLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        {hasChildren ? (
          children
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} icon={Sparkles} />
        )}
      </CardContent>
    </Card>
  );
}

function InsightLinkCard({
  item,
  original,
  type,
}: {
  item: Insight | Anomaly;
  original: Insight | Anomaly;
  type: 'insight' | 'anomaly';
}) {
  const iconTone =
    type === 'insight'
      ? 'border-info/20 bg-info-soft text-info'
      : 'border-warning/20 bg-warning-soft text-warning';

  return (
    <Link
      to={`/analytics/insights/${original.id}`}
      state={
        {
          insightPreview: {
            id: original.id,
            kind: original.kind,
            type,
            severity: original.severity,
            title: item.title,
            description: item.description,
            value: original.value,
            sessionId: original.sessionId,
          },
        } satisfies InsightPreviewState
      }
      className="block rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex items-start gap-3">
        <div className={`grid size-8 shrink-0 place-items-center rounded-full border ${iconTone}`}>
          {type === 'insight' ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
            <Badge variant={item.severity === 'high' ? 'warning' : 'neutral'}>
              {item.severity}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {item.description}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-subtle-foreground">{item.kind}</span>
            <span className="font-mono text-xs font-semibold text-foreground">{item.value}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MetricLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px_96px] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
      <span className={muted ? 'truncate text-subtle-foreground' : 'truncate text-foreground'}>
        {label}
      </span>
      <span className="font-mono font-medium text-foreground">{value}</span>
      <span className={`font-mono text-xs ${muted ? 'text-subtle-foreground' : 'text-success'}`}>
        {muted ? 'n/a' : '+0.0%'}
      </span>
    </div>
  );
}

function ToolSessionCard({
  session,
  color,
}: {
  session: AnalyticsReport['productivity']['topToolCallSessions'][number];
  color: string;
}) {
  return (
    <Link
      to={`/sessions/${session.sessionId}`}
      className="block rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-semibold text-foreground">
            {session.sessionId.slice(0, 12)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <BrandBadge value={session.cli} />
          </div>
        </div>
        <Badge variant="neutral">{session.toolCalls}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-subtle-foreground">
        <MetricChip label="custo" value={formatCurrency(session.cost)} />
        <MetricChip label="tokens" value={formatTokens(session.tokens)} />
        <MetricChip label="msgs" value={formatNumber(session.messagesPerToolCall)} />
      </div>
      <SparkTrace color={color} seed={session.toolCalls + session.messages} />
    </Link>
  );
}

function ModelUsageCard({
  item,
  color,
  onClick,
}: {
  item: AnalyticsReport['modelUsageBreakdown'][number];
  color: string;
  onClick: () => void;
}) {
  const tokens = item.inputTokens + item.outputTokens + item.reasoningTokens;

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-panel p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex items-start gap-3">
        <BrandBadge value={item.provider} kind="provider" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{item.model}</div>
          <div className="mt-1 text-xs text-subtle-foreground">{item.provider}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricChip label="custo" value={formatCurrency(item.totalCostUsd)} />
        <MetricChip label="uso" value={`${item.messageCount}`} />
        <MetricChip label="tokens" value={formatTokens(tokens)} />
      </div>
      <SparkTrace color={color} seed={item.messageCount + item.toolCallsCount} />
    </button>
  );
}

function InterpretationNote({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: 'success' | 'info' | 'warning';
}) {
  const toneClass = {
    success: 'border-success/20 bg-success-soft text-success',
    info: 'border-info/20 bg-info-soft text-info',
    warning: 'border-warning/20 bg-warning-soft text-warning',
  }[tone];

  return (
    <div className="flex gap-3 rounded-md border border-border bg-surface p-3">
      <div className={`grid size-8 shrink-0 place-items-center rounded-full border ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase text-subtle-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

function SparkTrace({ color, seed }: { color: string; seed: number }) {
  const bars = Array.from({ length: 12 }, (_, index) => 18 + ((seed + index * 17) % 54));

  return (
    <div className="mt-4 flex h-8 items-end gap-1" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-full rounded-t-sm"
          style={{ height: `${height}%`, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function localizeInsight(item: Insight, locale: string): Insight {
  if (locale !== 'pt-BR') return item;
  if (item.id === 'spend-growth')
    return {
      ...item,
      title: 'Uso crescendo mais rápido que na semana passada',
      description: item.description
        .replace('The last 7 days spent', 'Os últimos 7 dias gastaram')
        .replace('more than the previous 7 days.', 'a mais que os 7 dias anteriores.'),
    };
  if (item.id.startsWith('project-'))
    return {
      ...item,
      title: 'Um projeto domina os gastos',
      description: item.description
        .replace('is the highest-cost project and takes', 'é o projeto de maior custo e representa')
        .replace('of total spend.', 'do gasto total.'),
    };
  if (item.id.startsWith('model-'))
    return {
      ...item,
      title: 'Modelo caro usado em sessões leves',
      description: item.description
        .replace('averages', 'tem média de')
        .replace(
          'messages per session while staying well above the overall average cost.',
          'mensagens por sessão enquanto fica bem acima do custo médio geral.',
        ),
    };
  if (item.id.startsWith('session-'))
    return {
      ...item,
      title: 'Sessão longa e cara detectada',
      description: item.description
        .replace('Session', 'A sessão')
        .replace(
          'is among the priciest entries and may deserve a closer look.',
          'está entre as entradas mais caras e pode merecer uma análise.',
        ),
    };
  if (item.id.startsWith('cache-'))
    return {
      ...item,
      title: 'Alto desperdício de contexto em uma sessão',
      description: item.description.replace(
        'is missing cache hits for most of its input tokens.',
        'não teve cache hit na maior parte dos tokens de entrada.',
      ),
    };
  return item;
}

function localizeAnomaly(item: Anomaly, locale: string): Anomaly {
  if (locale !== 'pt-BR') return item;
  if (item.id.startsWith('spike-'))
    return {
      ...item,
      title: 'Pico diário de gasto',
      description: item.description
        .replace('The latest day spent', 'O último dia gastou')
        .replace('more than the 7-day baseline.', 'a mais que a baseline de 7 dias.'),
    };
  if (item.id.startsWith('tokens-'))
    return {
      ...item,
      title: 'Outlier de uso de tokens',
      description: item.description
        .replace('Session', 'A sessão')
        .replace(
          'used far more tokens than the typical session.',
          'usou muito mais tokens que uma sessão típica.',
        ),
    };
  if (item.id.startsWith('cost-'))
    return {
      ...item,
      title: 'Outlier de sessão de alto custo',
      description: item.description
        .replace('Session', 'A sessão')
        .replace(
          'is much more expensive than the average session.',
          'é muito mais cara que a sessão média.',
        ),
    };
  if (item.id === 'cache-basin')
    return {
      ...item,
      title: 'Taxa geral alta de cache miss',
      description: 'Nas sessões analisadas, os cache misses continuam elevados.',
    };
  return item;
}

function getBrandLabel(value: string): string {
  return getBrandMeta(value, 'cli').label;
}
