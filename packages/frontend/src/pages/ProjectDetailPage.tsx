import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
import {
  basename,
  compactPath,
  formatCurrency,
  formatDate,
  formatDuration,
} from '../lib/format.js';
import { chartColor } from '../lib/chart-colors.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { CompactStat } from '../components/ui/CompactStat.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '../components/ui/DataTable.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { DetailPageSkeleton } from '../components/ui/LoadingState.js';
import { MetricBlock } from '../components/ui/MetricBlock.js';
import { chartTooltipProps } from '../components/ui/ChartTooltip.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

interface ProjectDetailResponse {
  project: Record<string, unknown>;
  sessions: Record<string, unknown>[];
  providerBreakdown: Record<string, unknown>[];
  modelBreakdown: Record<string, unknown>[];
  spendOverTime: Record<string, unknown>[];
  commits: {
    branch: string | null;
    commits: { hash: string; author: string; date: string; message: string }[];
  };
}

export function ProjectDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const projectApiId = id ? encodeURIComponent(id) : '';
  const [openingProject, setOpeningProject] = useState(false);
  const { data, loading, validating, error, refetch } = useApi<ProjectDetailResponse>(
    `/api/projects/${projectApiId}`,
  );

  const derived = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const last = [...sessions].sort((a, b) =>
      String(b.started_at).localeCompare(String(a.started_at)),
    )[0];
    const topModel = (data?.modelBreakdown ?? [])[0]?.model as string | undefined;
    const topProvider = (data?.providerBreakdown ?? [])[0]?.provider as string | undefined;
    return { last, topModel: topModel ?? '—', topProvider: topProvider ?? '—' };
  }, [data]);

  if (loading && !data) return <DetailPageSkeleton />;
  if (error)
    return (
      <div className="p-4 lg:p-6">
        <ErrorState
          title={t('project.failed')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  if (!data?.project)
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title={t('project.notFound.title')}
          description={t('project.notFound.description')}
          icon={FolderOpen}
        />
      </div>
    );

  const p = data.project;
  const sessions = data.sessions;
  const spendData = data.spendOverTime.map((d) => ({ ...d, spend: Number(d.spend) || 0 }));
  const modelData = data.modelBreakdown.map((d) => ({
    name: String(d.model || t('common.unknown')),
    value: Number(d.cost) || 0,
  }));
  const providerData = data.providerBreakdown.map((d) => ({
    name: String(d.provider || t('common.unknown')),
    value: Number(d.cost) || 0,
  }));

  async function openProjectFolder() {
    if (!id || !p.exists || openingProject) return;
    setOpeningProject(true);
    try {
      await fetch(`/api/projects/${projectApiId}/open`, { method: 'POST' });
    } finally {
      setOpeningProject(false);
    }
  }

  return (
    <div className="space-y-5 p-4 lg:p-6" aria-busy={validating}>
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
      >
        <ArrowLeft className="h-4 w-4" /> {t('project.back')}
      </Link>

      <FigurePanel
        figure="PROJECT LAB"
        title={basename(String(p.path))}
        description={compactPath(String(p.path))}
        meta={
          <Badge variant={p.exists ? 'success' : 'warning'}>
            {p.exists ? t('common.available') : t('common.missing')}
          </Badge>
        }
        action={
          <Button
            variant="outline"
            onClick={openProjectFolder}
            disabled={!p.exists || openingProject}
            className="shrink-0"
          >
            <FolderOpen className="h-4 w-4" />
            {openingProject
              ? t('project.opening')
              : p.exists
                ? t('project.openFolder')
                : t('project.folderMissing')}
          </Button>
        }
        contentClassName="p-4 lg:p-5"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md border border-border bg-transparent text-subtle-foreground">
                <FolderOpen className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-sm text-muted-foreground">{String(p.path)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={p.exists ? 'success' : 'warning'}>
                {p.exists ? t('common.available') : t('common.missing')}
              </Badge>
              {p.git_remote ? (
                <Badge variant="neutral">
                  <GitBranch className="h-3 w-3" /> git
                </Badge>
              ) : (
                <Badge variant="warning">{t('projects.noRemote')}</Badge>
              )}
              {data.commits?.branch && <Badge variant="default">{data.commits.branch}</Badge>}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <CompactStat
                label={t('project.topProvider')}
                value={derived.topProvider}
                meta={t('common.provider')}
              />
              <CompactStat
                label={t('project.gitRemote')}
                value={String(p.git_remote ?? '—')}
                meta={data.commits?.branch ?? t('projects.noRemote')}
                tone={p.git_remote ? 'default' : 'warning'}
                valueClassName="font-mono text-[13px]"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <MetricBlock
                variant="compact"
                label={t('common.sessions')}
                value={String(p.total_sessions)}
              />
              <MetricBlock
                variant="compact"
                label={t('project.totalCost')}
                value={formatCurrency(p.total_cost as number)}
              />
              <MetricBlock
                variant="compact"
                label={t('project.lastActivity')}
                value={derived.last?.started_at ? formatDate(String(derived.last.started_at)) : '—'}
              />
              <MetricBlock
                variant="compact"
                label={t('project.topModel')}
                value={derived.topModel}
                meta={t('common.model')}
              />
            </div>
          </div>
        </div>
      </FigurePanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <FigurePanel figure="FIG. 01" title={t('project.spendOverTime')}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={spendData}>
              <defs>
                <linearGradient id="projectSpendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
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
                formatter={(v: number) => [formatCurrency(v), t('common.cost')]}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="var(--accent)"
                fill="url(#projectSpendGradient)"
                strokeWidth={2.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        </FigurePanel>

        <DistributionCard
          title={modelData.length ? t('project.modelDistribution') : t('project.distribution')}
          data={modelData.length ? modelData : providerData}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <FigurePanel figure="LEDGER 03" title={t('project.recentSessions')} contentClassName="p-0">
          <DataTableContainer>
            <DataTable>
              <DataTableHead className="sticky top-0 z-10 bg-surface">
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHeaderCell>{t('common.date')}</DataTableHeaderCell>
                  <DataTableHeaderCell>{t('common.model')}</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.cost')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.duration')}
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    {t('common.confidence')}
                  </DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {sessions.map((s) => (
                  <SessionRow key={String(s.id)} session={s} />
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableContainer>
        </FigurePanel>

        <div className="space-y-4">
          <BudgetControl projectPath={String(p.path)} projectCost={Number(p.total_cost) || 0} />
          <FigurePanel
            figure="GIT"
            title={t('project.gitTimeline')}
            action={data.commits?.branch && <Badge variant="neutral">{data.commits.branch}</Badge>}
            contentClassName="space-y-3"
          >
            {(data.commits?.commits ?? []).slice(0, 10).map((commit) => (
              <CommitRow key={commit.hash} commit={commit} />
            ))}
            {(data.commits?.commits.length ?? 0) === 0 && (
              <EmptyState
                title={t('project.noCommits.title')}
                description={t('project.noCommits.description')}
                icon={GitCommitHorizontal}
              />
            )}
          </FigurePanel>
        </div>
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  return (
    <FigurePanel
      figure="FIG. 02"
      title={title}
      contentClassName="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-1"
    >
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={78}
            innerRadius={48}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={chartColor(i)} />
            ))}
          </Pie>
          <Tooltip {...chartTooltipProps} formatter={(v: number) => [formatCurrency(v), '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-xs">
        {data.slice(0, 8).map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColor(i) }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="font-mono font-medium text-foreground">{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </FigurePanel>
  );
}

function BudgetControl({ projectPath, projectCost }: { projectPath: string; projectCost: number }) {
  const { t } = useI18n();
  const { data: budgets, refetch: refetchBudgets } = useApi<
    {
      id: number;
      scope_type: string;
      scope_value: string | null;
      limit_usd: number;
      period: string;
    }[]
  >('/api/budgets', { initialData: [] });
  const { data: status, refetch: refetchStatus } = useApi<
    {
      id: number;
      scope_value: string | null;
      current_spend: number;
      limit_usd: number;
      percentage: number;
      status: string;
    }[]
  >('/api/budgets/status', { initialData: [] });

  const projectBudget = (budgets ?? []).find(
    (b) => b.scope_type === 'project' && b.scope_value === projectPath,
  );
  const projectStatus = (status ?? []).find((s) => s.scope_value === projectPath);

  if (!projectBudget) {
    return (
      <FigurePanel figure="BUDGET" title={t('budget.title')} contentClassName="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('budget.project.empty')}</span>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            await fetch('/api/budgets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scope_type: 'project',
                scope_value: projectPath,
                limit_usd: Math.ceil(projectCost * 1.5) || 50,
                period: 'monthly',
              }),
            });
            await Promise.all([refetchBudgets(), refetchStatus()]);
          }}
        >
          <WalletCards className="h-3.5 w-3.5" />
          {t('budget.project.create')}
        </Button>
      </FigurePanel>
    );
  }

  return (
    <FigurePanel figure="BUDGET" title={t('budget.title')} contentClassName="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm capitalize text-muted-foreground">
          {t(`budget.period.${projectBudget.period}`)} {t('budget.limit')}
        </span>
        <Badge
          variant={
            projectStatus?.status === 'exceeded'
              ? 'danger'
              : projectStatus?.status === 'approaching'
                ? 'warning'
                : 'success'
          }
        >
          {projectStatus?.status === 'ok'
            ? t('budget.status.ok')
            : `${projectStatus?.percentage ?? 0}%`}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between font-mono text-sm">
          <span className="text-foreground">${(projectStatus?.current_spend ?? 0).toFixed(2)}</span>
          <span className="text-subtle-foreground">
            {t('common.of')} ${projectBudget.limit_usd.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full rounded-full transition-all ${
              (projectStatus?.status ?? 'ok') === 'exceeded'
                ? 'bg-danger'
                : (projectStatus?.status ?? 'ok') === 'approaching'
                  ? 'bg-warning'
                  : 'bg-accent'
            }`}
            style={{ width: `${Math.min(projectStatus?.percentage ?? 0, 100)}%` }}
          />
        </div>
      </div>

      {projectStatus && projectStatus.status !== 'ok' && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-danger" />
          <span className="text-danger">
            {projectStatus.status === 'exceeded'
              ? t('budget.status.exceeded')
              : t('budget.status.approaching')}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await fetch(`/api/budgets/${projectBudget.id}`, { method: 'DELETE' });
            await Promise.all([refetchBudgets(), refetchStatus()]);
          }}
        >
          {t('common.remove')}
        </Button>
      </div>
    </FigurePanel>
  );
}

function SessionRow({ session }: { session: Record<string, unknown> }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const sessionTarget = String(session.session_id ?? session.id);

  return (
    <DataTableRow
      className="cursor-pointer border-b border-border transition-colors hover:bg-surface-hover"
      onClick={() => navigate(`/sessions/${sessionTarget}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/sessions/${sessionTarget}`);
        }
      }}
      tabIndex={0}
      role="button"
    >
      <DataTableCell className="font-mono text-foreground">
        {formatDate(String(session.started_at))}
      </DataTableCell>
      <DataTableCell className="font-mono text-xs text-foreground">
        {String(session.model ?? '—')}
      </DataTableCell>
      <DataTableCell className="text-right font-mono tabular-nums text-foreground">
        <div>{formatCurrency(Number(session.total_cost_usd))}</div>
        {session.cost_source === 'estimated' && (
          <div className="mt-1 text-[10px] uppercase text-warning">{t('common.estimated')}</div>
        )}
      </DataTableCell>
      <DataTableCell className="text-right font-mono text-muted-foreground">
        {formatDuration(Number(session.duration_ms))}
      </DataTableCell>
      <DataTableCell className="text-right">
        <Badge
          variant={
            session.source_confidence === 'HIGH'
              ? 'success'
              : session.source_confidence === 'MEDIUM'
                ? 'default'
                : 'warning'
          }
        >
          {t(`common.confidence.${String(session.source_confidence).toLowerCase()}`)}
        </Badge>
      </DataTableCell>
    </DataTableRow>
  );
}

function CommitRow({
  commit,
}: {
  commit: { hash: string; author: string; date: string; message: string };
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-3 text-sm">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent">
        <GitCommitHorizontal className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{commit.message}</div>
        <div className="mt-1 font-mono text-xs text-subtle-foreground">
          {commit.hash} · {commit.author} · {formatDate(commit.date)}
        </div>
      </div>
    </div>
  );
}
