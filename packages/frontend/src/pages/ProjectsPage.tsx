import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  Folder,
  GitBranch,
  Grid2X2,
  List,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { ControlField } from '../components/ui/ControlField.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { basename, compactPath, formatCurrency } from '../lib/format.js';
import { Sensitive } from '../components/ui/Sensitive.js';
import type { LucideIcon } from 'lucide-react';

interface Project {
  id: number;
  path: string;
  git_remote: string | null;
  total_sessions: number;
  total_cost: number;
  exists: boolean;
  hidden?: number;
}

type StatusFilter = 'all' | 'available' | 'missing';
type GitFilter = 'all' | 'with-git' | 'without-git';
type SortMode = 'cost' | 'sessions' | 'name';
type ViewMode = 'grid' | 'list';

const PAGE_SIZE = 15;

export function ProjectsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [gitFilter, setGitFilter] = useState<GitFilter>('all');
  const [sort, setSort] = useState<SortMode>('cost');
  const [showHidden, setShowHidden] = useState(false);
  const [showCosts, setShowCosts] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [hidingId, setHidingId] = useState<number | null>(null);
  const { data, loading, validating, error, refetch } = useApi<{ data: Project[] }>(
    '/api/projects?includeHidden=1',
  );
  const isInitialLoading = loading && !data;

  const allProjects = data?.data ?? [];
  const visiblePool = useMemo(
    () => allProjects.filter((project) => !project.hidden),
    [allProjects],
  );
  const globalSummary = useMemo(
    () => ({
      visible: visiblePool.length,
      available: visiblePool.filter((project) => project.exists).length,
      missing: visiblePool.filter((project) => !project.exists).length,
      hidden: allProjects.filter((project) => project.hidden).length,
      spend: visiblePool.reduce((sum, project) => sum + Number(project.total_cost || 0), 0),
    }),
    [allProjects, visiblePool],
  );

  const projects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...allProjects]
      .filter((project) => {
        const matchesSearch =
          !term ||
          project.path.toLowerCase().includes(term) ||
          basename(project.path).toLowerCase().includes(term);
        const matchesStatus =
          status === 'all' || (status === 'available' ? project.exists : !project.exists);
        const matchesGit =
          gitFilter === 'all' ||
          (gitFilter === 'with-git' ? Boolean(project.git_remote) : !project.git_remote);
        return matchesSearch && matchesStatus && matchesGit && (!project.hidden || showHidden);
      })
      .sort((a, b) => {
        if (sort === 'sessions') return b.total_sessions - a.total_sessions;
        if (sort === 'name') return basename(a.path).localeCompare(basename(b.path));
        return b.total_cost - a.total_cost;
      });
  }, [allProjects, gitFilter, search, showHidden, sort, status]);

  useEffect(() => {
    setPage(1);
  }, [gitFilter, search, showHidden, sort, status]);

  const maxCost = useMemo(
    () => Math.max(1, ...projects.map((project) => Number(project.total_cost || 0))),
    [projects],
  );
  const topProjects = projects
    .filter((project) => !project.hidden)
    .filter((project) => project.total_cost > 0 || project.total_sessions > 0)
    .slice(0, 4);
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedProjects = projects.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = projects.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(projects.length, safePage * PAGE_SIZE);

  async function hideProject(id: number) {
    setHidingId(id);
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      await refetch();
    } finally {
      setHidingId(null);
    }
  }

  async function restoreProject(id: number) {
    setHidingId(id);
    try {
      await fetch(`/api/projects/${id}/restore`, { method: 'POST' });
      await refetch();
    } finally {
      setHidingId(null);
    }
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState
          title={t('projects.failed')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-4 lg:p-6">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <ProjectKpiCard
          label={t('projects.summary.visible')}
          value={String(globalSummary.visible)}
          meta={projectShare(globalSummary.visible, allProjects.length)}
          icon={Eye}
          tone="info"
        />
        <ProjectKpiCard
          label={t('projects.summary.available')}
          value={String(globalSummary.available)}
          meta={projectShare(globalSummary.available, Math.max(1, globalSummary.visible))}
          icon={ShieldCheck}
          tone="success"
        />
        <ProjectKpiCard
          label={t('projects.summary.missing')}
          value={String(globalSummary.missing)}
          meta={projectShare(globalSummary.missing, Math.max(1, globalSummary.visible))}
          icon={Folder}
          tone="warning"
        />
        <ProjectKpiCard
          label={t('projects.summary.hidden')}
          value={String(globalSummary.hidden)}
          meta={projectShare(globalSummary.hidden, Math.max(1, allProjects.length))}
          icon={EyeOff}
          tone="neutral"
        />
        <ProjectKpiCard
          label={t('projects.summary.spend')}
          value={<Sensitive>{formatCurrency(globalSummary.spend)}</Sensitive>}
          meta={t('dashboard.allSources')}
          icon={CircleDollarSign}
          tone="success"
        />
      </section>

      <Card variant="figure" className="overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('projects.search.placeholder')}
              className="h-12 pl-11"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ControlField label={t('common.status')}>
                <Select
                  className="h-10 text-[13px]"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as StatusFilter)}
                  options={[
                    { label: t('projects.allStatuses'), value: 'all' },
                    { label: t('common.available'), value: 'available' },
                    { label: t('common.missing'), value: 'missing' },
                  ]}
                />
              </ControlField>
              <ControlField label={t('common.sort')}>
                <Select
                  className="h-10 text-[13px]"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  options={[
                    { label: t('projects.sortCost'), value: 'cost' },
                    { label: t('projects.sortSessions'), value: 'sessions' },
                    { label: t('projects.sortName'), value: 'name' },
                  ]}
                />
              </ControlField>
              <ControlField label={t('projects.git.label')}>
                <Select
                  className="h-10 text-[13px]"
                  value={gitFilter}
                  onChange={(event) => setGitFilter(event.target.value as GitFilter)}
                  options={[
                    { label: t('projects.git.all'), value: 'all' },
                    { label: t('projects.git.with'), value: 'with-git' },
                    { label: t('projects.git.without'), value: 'without-git' },
                  ]}
                />
              </ControlField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
              <Button
                variant={showHidden ? 'subtle' : 'outline'}
                size="sm"
                className="h-10"
                onClick={() => setShowHidden((current) => !current)}
              >
                {showHidden ? t('projects.showVisible') : t('projects.showHidden')}
              </Button>
              <button
                type="button"
                onClick={() => setShowCosts((current) => !current)}
                className="inline-flex h-10 items-center gap-3 rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
              >
                <span
                  className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors ${showCosts ? 'justify-end border-accent/30 bg-accent-soft' : 'justify-start border-border bg-surface-muted'}`}
                >
                  <span
                    className={`size-3.5 rounded-full transition-colors ${showCosts ? 'bg-accent' : 'bg-subtle-foreground'}`}
                  />
                </span>
                {t('projects.showCosts')}
              </button>
              <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                {validating && !isInitialLoading
                  ? t('common.loading')
                  : `${projects.length} ${t('projects.results')}`}
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('common.refresh')}
                onClick={refetch}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {topProjects.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title={t('projects.top.title')} description={t('projects.top.description')}>
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('common.viewAll')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {topProjects.map((project) => (
              <FeaturedProjectCard
                key={project.id}
                project={project}
                maxCost={maxCost}
                showCosts={showCosts}
                onHide={hideProject}
                onRestore={restoreProject}
                hiding={hidingId === project.id}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle title={t('projects.all.title')} description={t('projects.all.description')}>
          <div className="inline-flex rounded-md border border-border bg-surface p-1">
            <Button
              variant={viewMode === 'grid' ? 'subtle' : 'quiet'}
              size="icon-sm"
              aria-label={t('projects.view.grid')}
              onClick={() => setViewMode('grid')}
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'subtle' : 'quiet'}
              size="icon-sm"
              aria-label={t('projects.view.list')}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </SectionTitle>

        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
              : 'grid grid-cols-1 gap-3'
          }
        >
          {isInitialLoading
            ? Array.from({ length: 9 }).map((_, index) => <ProjectSkeleton key={index} />)
            : pagedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  maxCost={maxCost}
                  showCosts={showCosts}
                  viewMode={viewMode}
                  onHide={hideProject}
                  onRestore={restoreProject}
                  hiding={hidingId === project.id}
                />
              ))}
        </div>

        {!isInitialLoading && projects.length > PAGE_SIZE && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={projects.length}
            onPageChange={setPage}
          />
        )}
      </section>

      {!isInitialLoading && projects.length === 0 && (
        <EmptyState
          title={t('projects.empty.title')}
          description={t('projects.empty.description')}
          icon={Folder}
        />
      )}
    </div>
  );
}

function ProjectKpiCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  meta: string;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'info' | 'neutral';
}) {
  const toneClass = {
    success: 'border-success/20 bg-success-soft text-success',
    warning: 'border-warning/20 bg-warning-soft text-warning',
    info: 'border-info/20 bg-info-soft text-info',
    neutral: 'border-border bg-surface-muted text-muted-foreground',
  }[tone];

  return (
    <Card variant="figure" className="overflow-hidden">
      <CardContent className="min-h-[132px] p-4">
        <div
          className={`grid size-9 place-items-center rounded-full border ${toneClass}`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-4 text-[11px] font-semibold uppercase text-muted-foreground">
          {label}
        </div>
        <div className="mt-3 font-mono text-3xl font-semibold leading-none text-foreground">
          {value}
        </div>
        <div className="mt-2 truncate text-xs text-muted-foreground">{meta}</div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FeaturedProjectCard({
  project,
  maxCost,
  showCosts,
  onHide,
  onRestore,
  hiding,
}: {
  project: Project;
  maxCost: number;
  showCosts: boolean;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  hiding: boolean;
}) {
  const { t } = useI18n();
  const detailPath = `/projects/${encodeURIComponent(project.path)}`;
  const percent = costPercent(project, maxCost);

  return (
    <Card
      interactive
      variant="figure"
      className={project.hidden ? 'overflow-hidden opacity-80' : 'overflow-hidden'}
    >
      <CardContent className="flex min-h-[308px] flex-col p-4">
        <ProjectCardHeader
          project={project}
          detailPath={detailPath}
          onHide={onHide}
          onRestore={onRestore}
          hiding={hiding}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ProjectStatusBadge project={project} />
          {project.git_remote ? (
            <Badge variant="neutral">
              <GitBranch className="h-3 w-3" /> git
            </Badge>
          ) : null}
        </div>

        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase text-subtle-foreground">
            {t('common.cost')}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-foreground">
            {showCosts ? <Sensitive>{formatCurrency(project.total_cost)}</Sensitive> : '----'}
          </div>
          <div className="mt-4">
            <ProjectCostTrace project={project} percent={percent} />
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4">
          <InlineProjectMetric
            label={t('common.sessions')}
            value={String(project.total_sessions)}
          />
          <InlineProjectMetric
            label={t('common.activity')}
            value={project.exists ? t('common.available') : t('common.missing')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectCard({
  project,
  maxCost,
  showCosts,
  viewMode,
  onHide,
  onRestore,
  hiding,
}: {
  project: Project;
  maxCost: number;
  showCosts: boolean;
  viewMode: ViewMode;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  hiding: boolean;
}) {
  const { t } = useI18n();
  const detailPath = `/projects/${encodeURIComponent(project.path)}`;
  const percent = costPercent(project, maxCost);

  if (viewMode === 'list') {
    return (
      <Card
        interactive
        variant="figure"
        className={`overflow-hidden ${project.hidden ? 'opacity-80' : ''}`}
      >
        <CardContent className="p-0">
          <div className="grid min-h-[116px] gap-0 lg:grid-cols-[minmax(280px,1.35fr)_minmax(320px,0.95fr)_minmax(260px,0.85fr)_96px] lg:items-stretch">
            <div className="flex min-w-0 flex-col justify-center gap-3 border-b border-border p-4 lg:border-b-0 lg:border-r">
              <ProjectIdentity project={project} detailPath={detailPath} />
              <div className="flex flex-wrap items-center gap-2">
                <ProjectStatusBadge project={project} />
                {project.git_remote ? (
                  <Badge variant="neutral">
                    <GitBranch className="h-3 w-3" /> git
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-border lg:border-b-0 lg:border-r">
              <ListProjectMetric
                label={t('common.cost')}
                value={
                  showCosts ? <Sensitive>{formatCurrency(project.total_cost)}</Sensitive> : '----'
                }
              />
              <ListProjectMetric
                label={t('common.sessions')}
                value={String(project.total_sessions)}
              />
              <ListProjectMetric
                label={t('common.activity')}
                value={project.exists ? t('common.available') : t('common.missing')}
              />
            </div>

            <div className="flex min-w-0 flex-col justify-center gap-3 border-b border-border p-4 lg:border-b-0 lg:border-r">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase text-subtle-foreground">
                  <span>{t('common.cost')}</span>
                  <span className="font-mono">{percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full ${project.exists ? 'bg-accent' : 'bg-warning'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              {project.git_remote ? (
                <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{project.git_remote}</span>
                </div>
              ) : (
                <div className="truncate text-xs text-subtle-foreground">
                  {t('projects.noRemote')}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-1 p-4 lg:justify-center">
              <ProjectActions
                project={project}
                detailPath={detailPath}
                onHide={onHide}
                onRestore={onRestore}
                hiding={hiding}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      interactive
      variant="figure"
      className={`h-full overflow-hidden ${project.hidden ? 'opacity-80' : ''}`}
    >
      <CardContent className="flex h-full min-h-[210px] flex-col gap-4 p-4">
        <div className="space-y-3">
          <ProjectCardHeader
            project={project}
            detailPath={detailPath}
            onHide={onHide}
            onRestore={onRestore}
            hiding={hiding}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge project={project} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <InlineProjectMetric
            label={t('common.cost')}
            value={showCosts ? <Sensitive>{formatCurrency(project.total_cost)}</Sensitive> : '----'}
          />
          <InlineProjectMetric
            label={t('common.sessions')}
            value={String(project.total_sessions)}
          />
          <InlineProjectMetric
            label={t('common.activity')}
            value={project.exists ? t('common.available') : t('common.missing')}
          />
        </div>

        <div className="mt-auto space-y-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${project.exists ? 'bg-accent' : 'bg-warning'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {project.git_remote ? (
            <div className="flex items-center gap-2 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{project.git_remote}</span>
            </div>
          ) : (
            <div className="border-t border-border pt-3 text-xs text-subtle-foreground">
              {t('projects.noRemote')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectCardHeader({
  project,
  detailPath,
  onHide,
  onRestore,
  hiding,
}: {
  project: Project;
  detailPath: string;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  hiding: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <ProjectIdentity project={project} detailPath={detailPath} />
      <ProjectActions
        project={project}
        detailPath={detailPath}
        onHide={onHide}
        onRestore={onRestore}
        hiding={hiding}
      />
    </div>
  );
}

function ProjectIdentity({ project, detailPath }: { project: Project; detailPath: string }) {
  return (
    <Link to={detailPath} className="flex min-w-0 flex-1 items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted-foreground">
        <Folder className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">
          {basename(project.path)}
        </div>
        <div className="mt-1 truncate font-mono text-xs text-subtle-foreground">
          {compactPath(project.path)}
        </div>
      </div>
    </Link>
  );
}

function ProjectActions({
  project,
  detailPath,
  onHide,
  onRestore,
  hiding,
}: {
  project: Project;
  detailPath: string;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  hiding: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={project.hidden ? t('projects.restore') : t('projects.hide')}
        title={project.hidden ? t('projects.restore.help') : t('projects.hide.help')}
        disabled={hiding}
        onClick={() => (project.hidden ? onRestore(project.id) : onHide(project.id))}
      >
        {project.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>
      <Link
        to={detailPath}
        className="grid size-8 place-items-center rounded-md border border-border bg-surface text-subtle-foreground transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
        aria-label={t('dashboard.openSession')}
      >
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ProjectStatusBadge({ project }: { project: Project }) {
  const { t } = useI18n();
  if (project.hidden) return <Badge variant="warning">{t('projects.hidden')}</Badge>;
  return (
    <Badge variant={project.exists ? 'success' : 'warning'}>
      {project.exists ? t('common.available') : t('common.missing')}
    </Badge>
  );
}

function InlineProjectMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-r border-border last:border-r-0">
      <div className="truncate text-[10px] font-semibold uppercase text-subtle-foreground">
        {label}
      </div>
      <div className="mt-2 truncate font-mono text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ListProjectMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-center border-r border-border p-4 last:border-r-0">
      <div className="truncate text-[10px] font-semibold uppercase text-subtle-foreground">
        {label}
      </div>
      <div className="mt-2 truncate font-mono text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ProjectCostTrace({ project, percent }: { project: Project; percent: number }) {
  const bars = Array.from({ length: 14 }, (_, index) => {
    const seed = basename(project.path).charCodeAt(index % basename(project.path).length) || 7;
    return 18 + ((seed + index * 13 + project.total_sessions * 5) % 56);
  });

  return (
    <div className="flex h-12 items-end gap-1" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={`${project.id}-${index}`}
          className={`w-full rounded-t-sm ${project.exists ? 'bg-accent/70' : 'bg-warning/70'}`}
          style={{ height: `${Math.min(82, Math.max(14, height + percent * 0.14))}%` }}
        />
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <span>
        {t('projects.pagination.range')
          .replace('{{start}}', String(rangeStart))
          .replace('{{end}}', String(rangeEnd))
          .replace('{{total}}', String(total))}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="quiet"
          size="icon-sm"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {'<'}
        </Button>
        {pages.map((item) => (
          <Button
            key={item}
            variant={item === page ? 'subtle' : 'quiet'}
            size="icon-sm"
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ))}
        <Button
          variant="quiet"
          size="icon-sm"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {'>'}
        </Button>
      </div>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <Card variant="figure">
      <CardContent>
        <div className="h-52 animate-pulse rounded-md border border-border bg-surface-muted" />
      </CardContent>
    </Card>
  );
}

function costPercent(project: Project, maxCost: number) {
  return Math.max(3, Math.min(100, Math.round((Number(project.total_cost || 0) / maxCost) * 100)));
}

function projectShare(value: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}
