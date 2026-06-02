import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Github,
  GitPullRequest,
  History,
  MessageSquare,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';
import { cn } from '../lib/utils.js';

type ReleaseCategory = 'all' | 'product' | 'analytics' | 'localFirst' | 'adapters' | 'infra';
type ReleaseChannel = 'stable' | 'milestone' | 'beta';

interface ReleaseEntry {
  key: string;
  date: string;
  channel: ReleaseChannel;
  commits: number;
  contributors: number;
  categories: Exclude<ReleaseCategory, 'all'>[];
  tags: string[];
}

const releaseTimeline: ReleaseEntry[] = [
  {
    key: 'changelog.released.13',
    date: '2026-06-02',
    channel: 'stable',
    commits: 9,
    contributors: 2,
    categories: ['product', 'analytics'],
    tags: ['changelog.ui', 'changelog.analytics'],
  },
  {
    key: 'changelog.released.12',
    date: '2026-06-01',
    channel: 'stable',
    commits: 12,
    contributors: 3,
    categories: ['product', 'analytics', 'localFirst'],
    tags: ['changelog.ui', 'changelog.analytics'],
  },
  {
    key: 'changelog.released.11',
    date: '2026-05-29',
    channel: 'stable',
    commits: 7,
    contributors: 2,
    categories: ['localFirst', 'infra'],
    tags: ['changelog.core', 'changelog.localFirst'],
  },
  {
    key: 'changelog.released.10',
    date: '2026-05-16',
    channel: 'milestone',
    commits: 11,
    contributors: 3,
    categories: ['product', 'localFirst'],
    tags: ['changelog.ui', 'changelog.i18n'],
  },
  {
    key: 'changelog.released.0',
    date: '2026-05-08',
    channel: 'stable',
    commits: 6,
    contributors: 2,
    categories: ['localFirst', 'infra'],
    tags: ['changelog.core', 'changelog.localFirst'],
  },
  {
    key: 'changelog.released.1',
    date: '2026-04-29',
    channel: 'stable',
    commits: 7,
    contributors: 2,
    categories: ['product'],
    tags: ['changelog.core', 'changelog.ui'],
  },
  {
    key: 'changelog.released.2',
    date: '2026-04-17',
    channel: 'stable',
    commits: 5,
    contributors: 2,
    categories: ['analytics'],
    tags: ['changelog.analytics', 'changelog.pricing'],
  },
  {
    key: 'changelog.released.3',
    date: '2026-04-07',
    channel: 'stable',
    commits: 6,
    contributors: 2,
    categories: ['analytics', 'localFirst'],
    tags: ['changelog.pricing', 'changelog.localFirst'],
  },
  {
    key: 'changelog.released.4',
    date: '2026-03-25',
    channel: 'stable',
    commits: 6,
    contributors: 2,
    categories: ['product', 'infra'],
    tags: ['changelog.core'],
  },
  {
    key: 'changelog.released.5',
    date: '2026-03-12',
    channel: 'stable',
    commits: 8,
    contributors: 2,
    categories: ['product'],
    tags: ['changelog.ui'],
  },
  {
    key: 'changelog.released.6',
    date: '2026-02-21',
    channel: 'stable',
    commits: 10,
    contributors: 3,
    categories: ['adapters'],
    tags: ['changelog.adapters'],
  },
  {
    key: 'changelog.released.7',
    date: '2026-02-04',
    channel: 'stable',
    commits: 7,
    contributors: 2,
    categories: ['analytics'],
    tags: ['changelog.analytics'],
  },
  {
    key: 'changelog.released.8',
    date: '2026-01-18',
    channel: 'stable',
    commits: 9,
    contributors: 2,
    categories: ['adapters', 'infra'],
    tags: ['changelog.adapters'],
  },
  {
    key: 'changelog.released.9',
    date: '2026-01-03',
    channel: 'stable',
    commits: 4,
    contributors: 1,
    categories: ['localFirst', 'infra'],
    tags: ['changelog.core', 'changelog.localFirst'],
  },
];

const categoryFilters: { key: ReleaseCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'changelog.tabs.all' },
  { key: 'product', labelKey: 'changelog.tabs.product' },
  { key: 'analytics', labelKey: 'changelog.tabs.analytics' },
  { key: 'localFirst', labelKey: 'changelog.tabs.localFirst' },
  { key: 'adapters', labelKey: 'changelog.tabs.adapters' },
  { key: 'infra', labelKey: 'changelog.tabs.infra' },
];

const recentActivities = [
  {
    versionKey: 'changelog.released.13.version',
    labelKey: 'changelog.activity.1',
    tone: 'success',
  },
  {
    versionKey: 'changelog.released.12.version',
    labelKey: 'changelog.activity.2',
    tone: 'success',
  },
  {
    versionKey: 'changelog.released.11.version',
    labelKey: 'changelog.activity.3',
    tone: 'success',
  },
  {
    versionKey: 'changelog.released.10.version',
    labelKey: 'changelog.activity.4',
    tone: 'warning',
  },
  { versionKey: 'changelog.released.0.version', labelKey: 'changelog.activity.5', tone: 'info' },
] as const;

const contributorRows = [
  {
    name: 'Mello',
    detailKey: 'changelog.contributors.mello.commits',
    initials: 'M',
    featured: true,
  },
  {
    name: 'Gui Ferreiro',
    detailKey: 'changelog.contributors.gui.commits',
    initials: 'GF',
    featured: false,
  },
  {
    name: 'Kiro CLI',
    detailKey: 'changelog.contributors.kiro.commits',
    initials: 'K',
    featured: false,
  },
  {
    name: 'Anthropic',
    detailKey: 'changelog.contributors.anthropic.commits',
    initials: 'A',
    featured: false,
  },
  {
    name: 'Command/Code',
    detailKey: 'changelog.contributors.commandcode.commits',
    initials: 'C',
    featured: false,
  },
] as const;

const roadmapItems = [
  { labelKey: 'changelog.roadmap.native', value: 52 },
  { labelKey: 'changelog.roadmap.sync', value: 34 },
  { labelKey: 'changelog.roadmap.workspace', value: 18 },
] as const;

const releasePaths = [
  {
    labelKey: 'changelog.paths.stable',
    descriptionKey: 'changelog.paths.stable.description',
    tone: 'success',
  },
  {
    labelKey: 'changelog.paths.beta',
    descriptionKey: 'changelog.paths.beta.description',
    tone: 'warning',
  },
  {
    labelKey: 'changelog.paths.canary',
    descriptionKey: 'changelog.paths.canary.description',
    tone: 'info',
  },
] as const;

export function ChangelogPage() {
  const { locale, t } = useI18n();
  const { theme } = useTheme();
  const [category, setCategory] = useState<ReleaseCategory>('all');
  const [query, setQuery] = useState('');

  const latestRelease = releaseTimeline[0];
  const totalReleases = 18;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [locale],
  );

  const filteredReleases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return releaseTimeline.filter((release) => {
      const matchesCategory = category === 'all' || release.categories.includes(category);
      const searchable = [
        t(`${release.key}.version`),
        t(`${release.key}.title`),
        t(`${release.key}.1`),
        t(`${release.key}.2`),
        t(`${release.key}.3`),
        ...release.tags.map((tag) => t(tag)),
      ]
        .join(' ')
        .toLowerCase();

      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, query, t]);

  const groupedReleases = useMemo(() => {
    return filteredReleases.reduce<Array<{ month: string; releases: ReleaseEntry[] }>>(
      (groups, release) => {
        const releaseDate = new Date(`${release.date}T00:00:00`);
        const month = new Intl.DateTimeFormat(locale, {
          month: 'long',
          year: 'numeric',
        })
          .format(releaseDate)
          .toUpperCase();
        const currentGroup = groups[groups.length - 1];

        if (currentGroup?.month === month) {
          currentGroup.releases.push(release);
          return groups;
        }

        groups.push({ month, releases: [release] });
        return groups;
      },
      [],
    );
  }, [filteredReleases, locale]);

  const logoSrc = theme === 'dark' ? '/sessionlens-white-logo.png' : '/sessionlens-black-logo.png';

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1780px] flex-col gap-5 overflow-y-auto p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
        <Button variant="subtle" size="sm">
          <MessageSquare className="h-4 w-4" />
          {t('changelog.feed')}
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t('common.refresh')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,520px)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={t('changelog.summary.latestVersion')}
            value={t(`${latestRelease.key}.version`)}
            detail={formatDate(latestRelease.date, dateFormatter)}
            badge={t('changelog.channel.stable')}
            icon={Rocket}
          />
          <SummaryCard
            label={t('changelog.summary.totalReleases')}
            value={String(totalReleases)}
            detail={t('changelog.summary.sinceStart')}
            icon={History}
          />
          <SummaryCard
            label={t('changelog.summary.currentMilestone')}
            value={t('changelog.summary.milestoneValue')}
            detail={t('changelog.summary.completed')}
            progress={67}
            icon={GitPullRequest}
          />
          <SummaryCard
            label={t('changelog.summary.roadmap')}
            value={t('changelog.summary.onTrack')}
            detail={t('changelog.summary.nextMilestones')}
            sparkline
            icon={Sparkles}
          />
        </div>

        <Card variant="flat" className="flex flex-col justify-between overflow-hidden">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase text-subtle-foreground">
                {t('changelog.controls.title')}
              </div>
              <Badge variant="success">{t('changelog.current')}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[160px_minmax(0,1fr)]">
              <Button variant="secondary" size="sm" className="justify-between">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {t('common.last30')}
                </span>
                <ChevronDown className="h-4 w-4 text-subtle-foreground" />
              </Button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('changelog.search.placeholder')}
                  className="pl-9 pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle-foreground">
                  /K
                </span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="default" size="sm">
                <MessageSquare className="h-4 w-4" />
                {t('changelog.subscribe')}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                {t('changelog.download')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat" className="overflow-hidden border-success/30 bg-success-soft/20">
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[270px_minmax(0,1fr)_220px] lg:items-center">
          <div className="space-y-4">
            <div className="text-[10px] font-semibold uppercase text-success">
              {t('changelog.featured.label')}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-semibold text-foreground">
                  {t(`${latestRelease.key}.version`)}
                </h2>
                <Badge variant="success">{t('changelog.channel.stable')}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDate(latestRelease.date, dateFormatter)} - {t('changelog.featured.elapsed')}
              </p>
            </div>
            <div className="grid gap-2">
              <ActionLink
                href="https://github.com/melloxyz/sessionlens/releases"
                icon={MessageSquare}
              >
                {t('changelog.featured.details')}
              </ActionLink>
              <ActionLink href="https://github.com/melloxyz/sessionlens/releases" icon={FileText}>
                {t('changelog.featured.migration')}
              </ActionLink>
            </div>
          </div>

          <div className="space-y-4 border-border lg:border-l lg:pl-6">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {t('changelog.featured.description')}
            </p>
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex gap-3 text-sm text-foreground">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{t(`changelog.latest.${item}.text`)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden h-44 place-items-center lg:grid">
            <div className="absolute h-44 w-44 rounded-full border border-success/10" />
            <div className="absolute h-32 w-32 rounded-full border border-success/20" />
            <div className="absolute h-24 w-24 rounded-full bg-success-soft blur-2xl" />
            <div className="relative grid h-20 w-20 place-items-center rounded-full border border-success/30 bg-surface shadow-[var(--shadow-floating)]">
              <img src={logoSrc} alt="Sessionlens" className="h-12 w-12 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              {categoryFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setCategory(filter.key)}
                  className={cn(
                    'h-8 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors',
                    category === filter.key
                      ? 'border-success/30 bg-success-soft text-success'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground',
                  )}
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {filteredReleases.length} {t('changelog.timeline.visible')}
            </div>
          </div>

          <div className="space-y-6">
            {groupedReleases.map((group) => (
              <section key={group.month} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px w-8 bg-border" />
                  <h2 className="text-[11px] font-semibold uppercase text-subtle-foreground">
                    {group.month}
                  </h2>
                </div>
                <div className="space-y-4">
                  {group.releases.map((release) => (
                    <TimelineItem
                      key={release.key}
                      release={release}
                      dateFormatter={dateFormatter}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <Button variant="outline" className="w-full">
            <ArrowDownToLine className="h-4 w-4" />
            {t('changelog.loadOlder')}
          </Button>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SidebarPanel title={t('changelog.activity.title')}>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <ActivityRow
                  key={activity.versionKey}
                  version={t(activity.versionKey)}
                  label={t(activity.labelKey)}
                  tone={activity.tone}
                />
              ))}
            </div>
            <SidebarLink href="https://github.com/melloxyz/sessionlens/releases">
              {t('changelog.activity.all')}
            </SidebarLink>
          </SidebarPanel>

          <SidebarPanel title={t('changelog.contributors.title')}>
            <div className="space-y-3">
              {contributorRows.map((contributor) => (
                <ContributorRow
                  key={contributor.name}
                  name={contributor.name}
                  detail={t(contributor.detailKey)}
                  initials={contributor.initials}
                  featured={contributor.featured}
                />
              ))}
            </div>
            <SidebarLink href="https://github.com/melloxyz/sessionlens/graphs/contributors">
              {t('changelog.contributors.all')}
            </SidebarLink>
          </SidebarPanel>

          <SidebarPanel title={t('changelog.roadmap.title')}>
            <div className="space-y-3">
              {roadmapItems.map((item) => (
                <ProgressRow key={item.labelKey} label={t(item.labelKey)} value={item.value} />
              ))}
            </div>
            <SidebarLink href="https://github.com/melloxyz/sessionlens/issues">
              {t('changelog.roadmap.full')}
            </SidebarLink>
          </SidebarPanel>

          <SidebarPanel title={t('changelog.paths.title')}>
            <div className="space-y-3">
              {releasePaths.map((path) => (
                <ReleasePath
                  key={path.labelKey}
                  label={t(path.labelKey)}
                  description={t(path.descriptionKey)}
                  tone={path.tone}
                />
              ))}
            </div>
            <SidebarLink href="https://github.com/melloxyz/sessionlens/releases">
              {t('changelog.paths.learn')}
            </SidebarLink>
          </SidebarPanel>

          <SidebarPanel title={t('changelog.notes.title')}>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('changelog.notes.description')}
            </p>
            <SidebarLink href="https://github.com/melloxyz/sessionlens">
              {t('changelog.notes.privacy')}
            </SidebarLink>
          </SidebarPanel>

          <SidebarPanel
            title={t('changelog.help.title')}
            action={
              <Button variant="quiet" size="icon-sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            }
          >
            <p className="text-sm leading-6 text-muted-foreground">
              {t('changelog.help.description')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ActionLink href="https://github.com/melloxyz/sessionlens" icon={BookOpen}>
                {t('changelog.help.docs')}
              </ActionLink>
              <ActionLink href="https://github.com/melloxyz/sessionlens/issues" icon={Github}>
                GitHub
              </ActionLink>
            </div>
          </SidebarPanel>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  badge,
  progress,
  sparkline,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  badge?: string;
  progress?: number;
  sparkline?: boolean;
  icon: LucideIcon;
}) {
  return (
    <Card variant="flat" className="min-h-[138px] overflow-hidden">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface-muted text-success">
            <Icon className="h-4 w-4" />
          </div>
          {badge ? <Badge variant="success">{badge}</Badge> : null}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
          <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
        </div>
        {progress ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {sparkline ? <MiniSparkline /> : null}
      </CardContent>
    </Card>
  );
}

function TimelineItem({
  release,
  dateFormatter,
}: {
  release: ReleaseEntry;
  dateFormatter: Intl.DateTimeFormat;
}) {
  const { t } = useI18n();
  const releaseDate = new Date(`${release.date}T00:00:00`);
  const day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(releaseDate);
  const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(releaseDate).toUpperCase();
  const channelVariant =
    release.channel === 'stable' ? 'success' : release.channel === 'milestone' ? 'warning' : 'info';

  return (
    <article className="grid grid-cols-[58px_minmax(0,1fr)] gap-4">
      <div className="relative flex justify-center">
        <span className="absolute bottom-[-1rem] top-12 w-px bg-border" />
        <div className="relative grid h-14 w-12 place-items-center rounded-md border border-border bg-surface text-center">
          <div>
            <div className="text-lg font-semibold leading-none text-foreground">{day}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase text-subtle-foreground">
              {month}
            </div>
          </div>
        </div>
      </div>

      <Card variant="flat" interactive>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-foreground">
                  {t(`${release.key}.version`)}
                </h3>
                <Badge variant={channelVariant}>{t(`changelog.channel.${release.channel}`)}</Badge>
                {release.tags.map((tag) => (
                  <Badge key={tag} variant="neutral">
                    {t(tag)}
                  </Badge>
                ))}
              </div>
              <h4 className="mt-3 text-base font-semibold text-foreground">
                {t(`${release.key}.title`)}
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t(`${release.key}.1`)}
              </p>
            </div>
            <Button variant="quiet" size="sm" className="shrink-0">
              {t('changelog.details')}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[2, 3].map((item) => (
              <div key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />
                <span>{t(`${release.key}.${item}`)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              {release.commits} {t('changelog.commits')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              {release.contributors} {t('changelog.contributors.count')}
            </span>
            <span>{formatDate(release.date, dateFormatter)}</span>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function SidebarPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="flat">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-semibold uppercase text-subtle-foreground">{title}</h3>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ActivityRow({
  version,
  label,
  tone,
}: {
  version: string;
  label: string;
  tone: 'success' | 'warning' | 'info';
}) {
  const toneClass = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full', toneClass)}>
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{version}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ContributorRow({
  name,
  detail,
  initials,
  featured,
}: {
  name: string;
  detail: string;
  initials: string;
  featured?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-xs font-semibold text-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
      {featured ? <Star className="h-4 w-4 fill-warning text-warning" /> : null}
    </div>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ReleasePath({
  label,
  description,
  tone,
}: {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'info';
}) {
  const toneClass = {
    success: 'bg-success',
    warning: 'bg-warning',
    info: 'bg-info',
  }[tone];

  return (
    <div className="flex gap-3">
      <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', toneClass)} />
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SidebarLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-success hover:text-accent"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function ActionLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-center text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
}

function MiniSparkline() {
  return (
    <div className="flex h-8 items-end gap-1">
      {[36, 58, 44, 72, 66, 88].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="w-full rounded-t bg-success/60"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function formatDate(date: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(`${date}T00:00:00`));
}
