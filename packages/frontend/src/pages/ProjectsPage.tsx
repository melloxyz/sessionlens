import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderOpen, GitBranch, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { basename, compactPath, formatCurrency } from '../lib/format.js';

interface Project {
  id: number;
  path: string;
  git_remote: string | null;
  total_sessions: number;
  total_cost: number;
  exists: boolean;
}

type StatusFilter = 'all' | 'available' | 'missing';
type SortMode = 'cost' | 'sessions' | 'name';

export function ProjectsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortMode>('cost');
  const [hidingId, setHidingId] = useState<number | null>(null);
  const { data, loading, error, refetch } = useApi<{ data: Project[] }>('/api/projects');

  async function hideProject(id: number) {
    setHidingId(id);
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      await refetch();
    } finally {
      setHidingId(null);
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title={t('projects.failed')} message={error.message} code={error.code} details={error.details} onRetry={refetch} />
      </div>
    );
  }

  const projects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(data?.data ?? [])]
      .filter((project) => {
        const matchesSearch = !term || project.path.toLowerCase().includes(term) || basename(project.path).toLowerCase().includes(term);
        const matchesStatus = status === 'all' || (status === 'available' ? project.exists : !project.exists);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sort === 'sessions') return b.total_sessions - a.total_sessions;
        if (sort === 'name') return basename(a.path).localeCompare(basename(b.path));
        return b.total_cost - a.total_cost;
      });
  }, [data, search, sort, status]);

  return (
    <div className="space-y-5 p-6">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('projects.search.placeholder')} className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              options={[{ label: t('projects.allStatuses'), value: 'all' }, { label: t('common.available'), value: 'available' }, { label: t('common.missing'), value: 'missing' }]}
            />
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              options={[{ label: t('projects.sortCost'), value: 'cost' }, { label: t('projects.sortSessions'), value: 'sessions' }, { label: t('projects.sortName'), value: 'name' }]}
            />
            <div className="hidden items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground md:flex">
              <SlidersHorizontal className="h-4 w-4" />
              {projects.length} {t('projects.shown')}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? Array.from({ length: 9 }).map((_, index) => <ProjectSkeleton key={index} />) : projects.map((project) => (
          <div key={project.id}>
            <Card interactive className="h-full overflow-hidden">
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <Link to={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${project.exists ? 'bg-accent-soft text-accent ring-accent/15' : 'bg-warning-soft text-warning ring-warning/15'}`}>
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold tracking-[-0.02em] text-foreground">{basename(project.path)}</div>
                      <div className="truncate text-xs text-subtle-foreground">{compactPath(project.path)}</div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={t('projects.hide')} disabled={hidingId === project.id} onClick={() => hideProject(project.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Link to={`/projects/${project.id}`} className="rounded-lg p-2 text-subtle-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={project.exists ? 'success' : 'warning'}>{project.exists ? t('common.available') : t('common.missing')}</Badge>
                  {project.git_remote && <Badge variant="neutral">git</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-surface-muted p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">{t('common.sessions')}</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">{project.total_sessions}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface-muted p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">{t('common.cost')}</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">{formatCurrency(project.total_cost)}</div>
                  </div>
                </div>

                {project.git_remote ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span className="truncate">{project.git_remote}</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-subtle-foreground">{t('projects.noRemote')}</div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {!loading && projects.length === 0 && (
        <EmptyState title={t('projects.empty.title')} description={t('projects.empty.description')} icon={FolderOpen} />
      )}
    </div>
  );
}

function ProjectSkeleton() {
  return <Card><CardContent><div className="h-40 animate-pulse rounded-2xl bg-surface-muted" /></CardContent></Card>;
}
