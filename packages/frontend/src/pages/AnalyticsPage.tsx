import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
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
import { compactPath, formatCurrency, formatDateTime, formatTokens } from '../lib/format.js';
import { chartColor } from '../lib/chart-colors.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { BrandBadge, getBrandMeta } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { CompactStat } from '../components/ui/CompactStat.js';
import { ControlField } from '../components/ui/ControlField.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { MetricTile } from '../components/ui/MetricTile.js';
import { ChartSkeleton, DonutSkeleton } from '../components/ui/LoadingState.js';
import { chartTooltipProps } from '../components/ui/ChartTooltip.js';
import { SectionHeader as SharedSectionHeader } from '../components/ui/SectionHeader.js';
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
    loading: tokenLoading,
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

      <DataPanel contentClassName="space-y-4 p-4">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {t('analytics.filters')}
                </div>
                <p className="mt-1 text-xs text-subtle-foreground">
                  {t('analytics.summaryDescription')}
                </p>
              </div>
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
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <ControlField label={t('analytics.groupBy')}>
                <Select
                  className="h-9 text-[13px]"
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
                  className="h-9 text-[13px]"
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
                  className="h-9 text-[13px]"
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
                  className="h-9 text-[13px]"
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
                  className="h-9 text-[13px]"
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
                  className="h-9 text-[13px]"
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

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.clear}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    <span>{filter.label}</span>
                    <span className="text-subtle-foreground">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <CompactStat
              label={t('common.cost')}
              value={formatCurrency(report?.summary.totalSpend)}
              meta={t('common.total')}
            />
            <CompactStat
              label={t('analytics.insights')}
              value={String(insights.length)}
              meta={dimensionLabel}
            />
            <CompactStat
              label={t('analytics.anomalies')}
              value={String(anomalies.length)}
              meta={metricLabel}
              tone={anomalies.length > 0 ? 'warning' : 'default'}
            />
            <CompactStat
              label={t('analytics.live')}
              value={report?.generatedAt ? formatDateTime(report.generatedAt) : '—'}
              meta={t('analytics.summaryTitle')}
            />
          </div>
        </div>
      </DataPanel>

      <SectionHeader
        title={t('analytics.summaryTitle')}
        description={t('analytics.summaryDescription')}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <SummaryCard
          icon={TrendingUp}
          label={t('analytics.sevenDaySpend')}
          value={formatCurrency(report?.summary.current7DaySpend)}
          sub={
            report?.summary.growthPercent != null
              ? `${report.summary.growthPercent >= 0 ? '+' : ''}${report.summary.growthPercent.toFixed(0)}% ${t('analytics.vsPriorWeek')}`
              : t('analytics.notEnoughData')
          }
          tone="success"
          loading={reportLoading && !report}
        />
        <SummaryCard
          icon={Gauge}
          label={t('analytics.baselineDay')}
          value={formatCurrency(report?.summary.baselineDailySpend)}
          sub={t('analytics.movingBaseline')}
          tone="info"
          loading={reportLoading && !report}
        />
        <SummaryCard
          icon={Sparkles}
          label={t('analytics.insights')}
          value={String(insights.length)}
          sub={t('analytics.actionableFindings')}
          tone="warning"
          loading={reportLoading && !report}
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t('analytics.anomalies')}
          value={String(anomalies.length)}
          sub={t('analytics.outliers')}
          tone="danger"
          loading={reportLoading && !report}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Sparkles}
          label={t('analytics.toolCalls')}
          value={String(productivity?.totalToolCalls ?? 0)}
          sub={t('analytics.totalAcrossSessions')}
          tone="info"
          loading={reportLoading && !report}
        />
        <SummaryCard
          icon={Gauge}
          label={t('analytics.callsSession')}
          value={(productivity?.avgToolCallsPerSession ?? 0).toFixed(1)}
          sub={t('analytics.averageDensity')}
          tone="success"
          loading={reportLoading && !report}
        />
        <SummaryCard
          icon={TrendingUp}
          label={t('analytics.tokensTool')}
          value={formatTokens(productivity?.avgTokensPerToolCall)}
          sub={t('analytics.efficiencyIndicator')}
          tone="warning"
          loading={reportLoading && !report}
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t('analytics.costTool')}
          value={formatCurrency(productivity?.avgCostPerToolCall)}
          sub={
            productivity?.costToolCallCorrelation != null
              ? `${t('analytics.correlation')} ${productivity.costToolCallCorrelation.toFixed(2)}`
              : t('analytics.correlationUnavailable')
          }
          tone="danger"
          loading={reportLoading && !report}
        />
      </div>

      <SectionHeader
        title={`${t('analytics.insightsTitle')} & ${t('analytics.anomaliesTitle')}`}
        description={t('analytics.insightsDescription')}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr] 2xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.insightsTitle')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.insightsDescription')}
              </p>
            </div>
            <Badge variant="neutral">
              {isValidating
                ? t('common.loading')
                : report
                  ? t('analytics.live')
                  : t('common.loading')}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 2xl:grid-cols-2">
            {insights.length > 0 ? (
              insights.map((insight) => {
                const localized = localizeInsight(insight, locale);
                return (
                  <Link key={insight.id} to={`/analytics/insights/${insight.id}`} className="block">
                    <InsightRow item={localized} label={t('analytics.insight')} />
                  </Link>
                );
              })
            ) : (
              <EmptyState
                title={t('analytics.noInsights.title')}
                description={t('analytics.noInsights.description')}
                icon={Sparkles}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.anomaliesTitle')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.anomaliesDescription')}
              </p>
            </div>
            <Badge variant="neutral">{t('analytics.baseline')}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {anomalies.length > 0 ? (
              anomalies.map((anomaly) => {
                const localized = localizeAnomaly(anomaly, locale);
                return (
                  <Link key={anomaly.id} to={`/analytics/insights/${anomaly.id}`} className="block">
                    <AnomalyRow item={localized} label={t('analytics.anomaly')} />
                  </Link>
                );
              })
            ) : (
              <EmptyState
                title={t('analytics.noAnomalies.title')}
                description={t('analytics.noAnomalies.description')}
                icon={CircleAlert}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader
        title={t('analytics.trendsTitle')}
        description={t('analytics.trendsDescription')}
      />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>
                  {spendGranularity === 'day'
                    ? t('analytics.dailySpend')
                    : spendGranularity === 'month'
                      ? t('analytics.monthlySpend')
                      : t('analytics.weeklySpend')}
                </CardTitle>
                <p className="mt-1 text-xs text-subtle-foreground">
                  {t('analytics.weeklySpendDescription')}
                </p>
              </div>
              <Select
                value={spendGranularity}
                onChange={(e) => setSpendGranularity(e.target.value as 'day' | 'week' | 'month')}
                options={[
                  { label: t('analytics.granularityDay'), value: 'day' },
                  { label: t('analytics.granularityWeek'), value: 'week' },
                  { label: t('analytics.granularityMonth'), value: 'month' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent>
            {spendLoading && !spendData && !report ? (
              <ChartSkeleton className="h-[260px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={spendData?.points ?? report?.trend ?? []}>
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
                    fill="url(#spendGradient)"
                    strokeWidth={2.4}
                    dot={{ r: 3, fill: 'var(--accent)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('session.tokenUsage')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.tokenUsageDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {tokenLoading && !tokenData ? (
              <ChartSkeleton className="h-[260px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tokenData?.points ?? []}>
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
                    tickFormatter={(v: number) => formatTokens(v)}
                  />
                  <Tooltip {...chartTooltipProps} />
                  <Area
                    type="monotone"
                    dataKey="inputTokens"
                    stroke="var(--accent)"
                    fill="var(--accent-soft)"
                    strokeWidth={2}
                    name={t('common.input')}
                  />
                  <Area
                    type="monotone"
                    dataKey="outputTokens"
                    stroke="var(--success)"
                    fill="var(--success-soft)"
                    strokeWidth={2}
                    name={t('common.output')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader
        title={t('analytics.explorerTitle')}
        description={t('analytics.explorerDescription')}
      />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.88fr_1.12fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.breakdown')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.breakdownDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center 2xl:gap-8">
            {breakdownLoading && !breakdownData ? (
              <DonutSkeleton className="w-full lg:flex-1" />
            ) : (
              <>
                <div className="mx-auto h-48 w-full max-w-[260px] lg:h-[220px] lg:flex-[0_0_45%] lg:max-w-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={55}
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
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2 lg:min-w-[220px] lg:grid-cols-1">
                  {breakdown.map((d, i) => (
                    <div
                      key={d.label}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-surface-elevated"
                      onClick={() => setDimensionFilter(d.label)}
                    >
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: chartColor(i) }}
                      />
                      <span className="max-w-[160px] truncate text-subtle-foreground">
                        {d.label}
                      </span>
                      <span className="ml-auto font-mono font-medium text-foreground">
                        {d.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{breakdownTitle}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.topProjectsDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {breakdownLoading && !breakdownData ? (
              <ChartSkeleton className="h-[260px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={breakdown.slice(0, 8)} layout="vertical" margin={{ left: 72 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      metric === 'cost' ? formatCurrency(v) : String(v)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }}
                    width={72}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip {...chartTooltipProps} />
                  <Bar
                    dataKey="value"
                    fill="var(--accent)"
                    radius={[0, 4, 4, 0]}
                    onClick={(data: { label: string }) => setDimensionFilter(data.label)}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader
        title={t('analytics.productivityTitle')}
        description={t('analytics.productivityDescription')}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.productivity')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.productivityDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <div className="rounded-lg border border-dashed border-border p-4 font-mono text-xs text-subtle-foreground">
              {productivity?.notes?.[0] ?? t('analytics.filesNote')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.topToolSessions')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.topToolSessionsDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 2xl:grid-cols-2">
            {(productivity?.topToolCallSessions ?? []).length > 0 ? (
              productivity!.topToolCallSessions.map((session) => (
                <Link
                  key={session.sessionId}
                  to={`/sessions/${session.sessionId}`}
                  className="block rounded-lg border border-border bg-surface-elevated p-4 text-sm transition-colors hover:bg-surface-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {session.sessionId.slice(0, 12)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <BrandBadge value={session.cli} />
                        <BrandBadge value={session.provider} kind="provider" />
                      </div>
                      <div className="mt-2 text-xs text-subtle-foreground">
                        {session.model ?? 'unknown'}
                      </div>
                    </div>
                    <Badge variant="neutral">
                      {session.toolCalls} {t('common.tools').toLowerCase()}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-subtle-foreground md:grid-cols-4">
                    <MetricChip label={t('common.cost')} value={formatCurrency(session.cost)} />
                    <MetricChip label={t('common.tokens')} value={formatTokens(session.tokens)} />
                    <MetricChip
                      label={t('analytics.messagesTool')}
                      value={formatNumber(session.messagesPerToolCall)}
                    />
                    <MetricChip
                      label={t('analytics.tokensToolShort')}
                      value={formatNumber(session.tokensPerToolCall)}
                    />
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title={t('analytics.noProductivity.title')}
                description={t('analytics.noProductivity.description')}
                icon={Sparkles}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader
        title={t('analytics.modelUsageTitle')}
        description={t('analytics.multiModelDescription')}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.multiModel')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.multiModelDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 2xl:grid-cols-2">
            {modelUsage.length > 0 ? (
              modelUsage.slice(0, 8).map((item) => (
                <div
                  key={`${item.provider}/${item.model}`}
                  className="cursor-pointer rounded-lg border border-border bg-surface-elevated p-4 text-sm transition-colors hover:bg-surface-hover"
                  onClick={() => {
                    setProviderFilter(providerFilter === item.provider ? '' : item.provider);
                    setModelFilter(modelFilter === item.model ? '' : item.model);
                  }}
                  title={t('analytics.clickToFilterByModel')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <BrandBadge value={item.provider} kind="provider" />
                        <span className="text-sm font-medium text-foreground">{item.model}</span>
                      </div>
                      <div className="text-xs text-subtle-foreground">
                        {item.messageCount} {t('common.messages').toLowerCase()} ·{' '}
                        {item.toolCallsCount} {t('common.tools').toLowerCase()}
                      </div>
                    </div>
                    <Badge variant="neutral">{formatCurrency(item.totalCostUsd)}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-subtle-foreground md:grid-cols-4">
                    <MetricChip label={t('common.input')} value={formatTokens(item.inputTokens)} />
                    <MetricChip
                      label={t('common.output')}
                      value={formatTokens(item.outputTokens)}
                    />
                    <MetricChip
                      label={t('common.reasoning')}
                      value={formatTokens(item.reasoningTokens)}
                    />
                    <MetricChip label={t('common.tools')} value={String(item.toolCallsCount)} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={t('analytics.noMultiModel.title')}
                description={t('analytics.noMultiModel.description')}
                icon={Sparkles}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('analytics.multiModelNotes')}</CardTitle>
              <p className="mt-1 text-xs text-subtle-foreground">
                {t('analytics.multiModelNotesDescription')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-subtle-foreground">
            <div className="rounded-lg border border-border bg-surface-elevated p-4">
              {t('analytics.opencodeNote')}
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated p-4">
              {t('analytics.singleModelNote')}
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated p-4">
              {t('analytics.filesDeferredNote')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <SharedSectionHeader title={title} description={description} />;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  loading?: boolean;
}) {
  return (
    <MetricTile
      icon={Icon}
      label={label}
      value={value}
      meta={sub}
      tone={tone}
      loading={loading}
      compact
      iconVariant="neutral"
    />
  );
}

function InsightRow({ item, label }: { item: Insight; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant={
                item.severity === 'high'
                  ? 'success'
                  : item.severity === 'medium'
                    ? 'default'
                    : 'neutral'
              }
            >
              {item.kind}
            </Badge>
            <span className="text-xs text-subtle-foreground">{label}</span>
          </div>
          <div className="text-sm font-medium text-foreground">{item.title}</div>
          <p className="mt-1 text-sm text-subtle-foreground">{item.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{item.value}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function AnomalyRow({ item, label }: { item: Anomaly; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant={
                item.severity === 'high'
                  ? 'warning'
                  : item.severity === 'medium'
                    ? 'default'
                    : 'neutral'
              }
            >
              {item.kind}
            </Badge>
            <span className="text-xs text-subtle-foreground">{label}</span>
          </div>
          <div className="text-sm font-medium text-foreground">{item.title}</div>
          <p className="mt-1 text-sm text-subtle-foreground">{item.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{item.value}</span>
          <CircleAlert className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function MetricLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm">
      <span className={muted ? 'text-subtle-foreground' : 'text-foreground'}>{label}</span>
      <span
        className={`font-mono font-medium ${muted ? 'text-subtle-foreground' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[10px] uppercase text-subtle-foreground">{label}</div>
      <div className="mt-1 font-mono font-medium text-foreground">{value}</div>
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
