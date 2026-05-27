import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FolderOpen, GitCommitHorizontal } from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import { basename, compactPath, formatCurrency, formatDate, formatDuration } from '../lib/format.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

const COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#22c55e', '#eab308', '#ef4444'];
const tooltipStyle = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  color: 'var(--foreground)',
  boxShadow: 'var(--shadow-card)',
  fontSize: 12,
};

export function ProjectDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useApi<{
    project: Record<string, unknown>;
    sessions: Record<string, unknown>[];
    providerBreakdown: Record<string, unknown>[];
    modelBreakdown: Record<string, unknown>[];
    spendOverTime: Record<string, unknown>[];
    commits: { branch: string | null; commits: { hash: string; author: string; date: string; message: string }[] };
  }>(`/api/projects/${id}`);

  if (loading) return <LoadingState />;
  if (error) return <div className="p-6"><ErrorState title={t('project.failed')} message={error.message} code={error.code} details={error.details} onRetry={refetch} /></div>;
  if (!data?.project) return <div className="p-6"><EmptyState title={t('project.notFound.title')} description={t('project.notFound.description')} icon={FolderOpen} /></div>;

  const p = data.project;

  return (
    <div className="space-y-6 p-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-subtle-foreground" />
          <h1 className="text-lg font-semibold text-foreground">{basename(String(p.path))}</h1>
        </div>
        <p className="mt-1 text-sm text-subtle-foreground">{compactPath(String(p.path))}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label={t('common.sessions')} value={String(p.total_sessions)} />
        <MetricCard label={t('project.totalCost')} value={formatCurrency(p.total_cost as number)} />
        <MetricCard label={t('project.avgCost')} value={formatCurrency((Number(p.total_cost) || 0) / (Number(p.total_sessions) || 1))} />
        <MetricCard label={t('project.gitRemote')} value={String(p.git_remote ?? '—')} compact />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('project.spendOverTime')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.spendOverTime.map((d: any) => ({ ...d, spend: Number(d.spend) }))}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--subtle-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="rgba(99,102,241,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('project.modelDistribution')}</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={data.modelBreakdown.map((d: any) => ({ name: d.model || 'unknown', value: Number(d.cost) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {data.modelBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs">
              {data.modelBreakdown.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{d.model || 'unknown'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('common.sessions')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle-foreground">
                  <th className="px-4 py-3 text-left font-medium">{t('common.date')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('common.model')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('common.cost')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('common.duration')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('common.confidence')}</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-border transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3 text-foreground">
                      <Link to={`/sessions/${s.id}`} className="hover:text-accent-hover">{formatDate(String(s.started_at))}</Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{String(s.model ?? '—')}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      <div>{formatCurrency(Number(s.total_cost_usd))}</div>
                      {s.cost_source === 'estimated' && <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-warning">{t('common.estimated')}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDuration(Number(s.duration_ms))}</td>
                    <td className="px-4 py-3 text-right"><Badge variant={s.source_confidence === 'HIGH' ? 'success' : s.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>{s.source_confidence}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('project.gitCommits')}</CardTitle>
          {data.commits?.branch && <Badge variant="neutral">{data.commits.branch}</Badge>}
        </CardHeader>
        <CardContent className="space-y-3">
          {(data.commits?.commits ?? []).map((commit) => (
            <div key={commit.hash} className="flex items-start gap-3 rounded-2xl border border-border bg-surface-muted p-3 text-sm">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <GitCommitHorizontal className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{commit.message}</div>
                <div className="mt-1 text-xs text-subtle-foreground">{commit.hash} · {commit.author} · {formatDate(commit.date)}</div>
              </div>
            </div>
          ))}
          {(data.commits?.commits.length ?? 0) === 0 && (
            <EmptyState title={t('project.noCommits.title')} description={t('project.noCommits.description')} icon={GitCommitHorizontal} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="mb-1 text-xs uppercase tracking-[0.12em] text-subtle-foreground">{label}</div>
        <div className={`${compact ? 'truncate text-sm' : 'text-xl tracking-[-0.04em]'} font-semibold text-foreground`}>{value}</div>
      </CardContent>
    </Card>
  );
}
