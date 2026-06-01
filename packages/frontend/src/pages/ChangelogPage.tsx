import {
  CheckCircle2,
  CircleDot,
  GitBranch,
  Monitor,
  RadioTower,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge } from '../components/ui/Badge.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { SectionHeader } from '../components/ui/SectionHeader.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';

const releaseTimeline = [
  { key: 'changelog.released.12', tags: ['changelog.ui', 'changelog.analytics'] },
  { key: 'changelog.released.11', tags: ['changelog.core', 'changelog.localFirst'] },
  { key: 'changelog.released.10', tags: ['changelog.ui', 'changelog.i18n'] },
  { key: 'changelog.released.0', tags: ['changelog.core', 'changelog.localFirst'] },
  { key: 'changelog.released.1', tags: ['changelog.core', 'changelog.ui'] },
  { key: 'changelog.released.2', tags: ['changelog.analytics', 'changelog.pricing'] },
  { key: 'changelog.released.3', tags: ['changelog.pricing', 'changelog.localFirst'] },
  { key: 'changelog.released.4', tags: ['changelog.core'] },
  { key: 'changelog.released.5', tags: ['changelog.ui'] },
  { key: 'changelog.released.6', tags: ['changelog.adapters'] },
  { key: 'changelog.released.7', tags: ['changelog.analytics'] },
  { key: 'changelog.released.8', tags: ['changelog.adapters'] },
  { key: 'changelog.released.9', tags: ['changelog.core', 'changelog.localFirst'] },
];

const inProgressCount = 2;
const plannedCount = 3;

const contributors = [
  {
    name: 'Mello',
    github: 'melloxyz',
    roleKey: 'changelog.contributors.mello.role',
  },
];

const statusCards: {
  icon: LucideIcon;
  labelKey: string;
  valueKey: string;
}[] = [
  {
    icon: Monitor,
    labelKey: 'changelog.status.focus',
    valueKey: 'changelog.status.focusValue',
  },
  {
    icon: ShieldCheck,
    labelKey: 'changelog.status.localFirst',
    valueKey: 'changelog.status.localFirstValue',
  },
  {
    icon: RadioTower,
    labelKey: 'changelog.status.pricing',
    valueKey: 'changelog.status.pricingValue',
  },
];

export function ChangelogPage() {
  const { t } = useI18n();
  const { theme } = useTheme();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1780px] flex-col gap-4 overflow-y-auto p-4 lg:p-6">
      <DataPanel contentClassName="grid gap-4 p-4 2xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={
                  theme === 'dark' ? '/sessionlens-white-logo.png' : '/sessionlens-black-logo.png'
                }
                alt="Sessionlens"
                className="h-12 w-12 shrink-0 rounded-md"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase text-subtle-foreground">
                  Sessionlens
                </div>
                <div className="truncate text-base font-semibold text-foreground">Sessionlens</div>
                <div className="truncate text-xs text-muted-foreground">
                  Local AI CLI observability
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{t('changelog.current')}</Badge>
              <Badge variant="neutral">{t('changelog.version')}</Badge>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="rounded-md border border-border bg-surface px-5 py-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="default" className="gap-1.5">
                  <Sparkles className="h-3 w-3" /> Sessionlens
                </Badge>
                <Badge variant="neutral">{t('changelog.version')}</Badge>
              </div>
              <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground 2xl:text-[2rem]">
                {t('changelog.hero.title')}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('changelog.hero.description')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              {[1, 2, 3].map((item) => (
                <ReleaseHighlight
                  key={item}
                  text={t(`changelog.latest.${item}.text`)}
                  className={item === 3 ? 'sm:col-span-2' : undefined}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <div className="mb-3 text-[11px] font-semibold uppercase text-subtle-foreground">
              {t('changelog.status.title')}
            </div>
            <div className="space-y-2.5">
              {statusCards.map((card) => (
                <HeroStatusRow
                  key={card.labelKey}
                  icon={card.icon}
                  label={t(card.labelKey)}
                  value={t(card.valueKey)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
            <ActionLink href="https://github.com/melloxyz/sessionlens" icon={GitBranch}>
              {t('changelog.status.repository')}
            </ActionLink>
            <ActionLink href="https://github.com/melloxyz/sessionlens/releases" icon={CheckCircle2}>
              {t('changelog.status.releases')}
            </ActionLink>
            <ActionLink href="https://github.com/melloxyz/sessionlens/issues" icon={CircleDot}>
              {t('changelog.status.issues')}
            </ActionLink>
          </div>
        </div>
      </DataPanel>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden">
          <div className="flex items-end justify-between gap-2 px-1">
            <SectionHeader
              title={t('changelog.timeline.title')}
              description={t('changelog.timeline.description')}
            />
          </div>

          <DataPanel
            className="min-h-0"
            contentClassName="max-h-[720px] overflow-y-auto overflow-x-hidden p-2 lg:p-3"
          >
            <div className="space-y-2">
              {releaseTimeline.map((entry) => (
                <TimelineItem key={entry.key} entryKey={entry.key} tags={entry.tags} />
              ))}
            </div>
          </DataPanel>
        </section>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:pt-11">
          <DataPanel
            title={t('changelog.contributors.title')}
            description={t('changelog.contributors.description')}
            contentClassName="space-y-3 p-3"
          >
            {contributors.map((c) => (
              <a
                key={c.github}
                href={`https://github.com/${c.github}`}
                target="_blank"
                rel="noreferrer"
                className="group block"
              >
                <div className="flex items-center gap-3 rounded-md border border-border bg-surface-muted p-3 transition-colors group-hover:bg-surface-hover">
                  <img
                    src={`https://avatars.githubusercontent.com/${c.github}`}
                    alt={c.name}
                    className="h-10 w-10 shrink-0 rounded-full border border-border"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
                      {c.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t(c.roleKey)}</div>
                    <div className="mt-1 truncate font-mono text-[10px] text-subtle-foreground">
                      github.com/{c.github}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </DataPanel>

          <CombinedStatusSection inProgressCount={inProgressCount} plannedCount={plannedCount} />
        </aside>
      </div>
    </div>
  );
}

function ReleaseHighlight({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`rounded-md border border-border bg-surface-muted p-4 ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
        <p className="text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function HeroStatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
        <div className="mt-1 text-sm font-medium leading-6 text-foreground">{value}</div>
      </div>
    </div>
  );
}

function CombinedStatusSection({
  inProgressCount,
  plannedCount,
}: {
  inProgressCount: number;
  plannedCount: number;
}) {
  const { t } = useI18n();

  return (
    <DataPanel
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      contentClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <CircleDot className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase text-foreground">
          {t('changelog.inProgress')} & {t('changelog.planned')}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-t border-border">
          <div className="px-3 pt-2 pb-0.5">
            <span className="text-[10px] font-semibold uppercase text-amber-300/80">
              {t('changelog.inProgress')}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {Array.from({ length: inProgressCount }, (_, i) => i + 1).map((n) => (
              <li key={`ip-${n}`} className="flex items-start gap-2 px-3 py-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                <span className="text-[12px] leading-[1.45] text-muted-foreground">
                  {t(`changelog.inProgress.${n}`)}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-border px-3 pt-2 pb-0.5">
            <span className="text-[10px] font-semibold uppercase text-subtle-foreground">
              {t('changelog.planned')}
            </span>
          </div>
          <ul>
            {Array.from({ length: plannedCount }, (_, i) => i + 1).map((n) => (
              <li key={`pl-${n}`} className="flex items-start gap-2 px-3 py-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-subtle-foreground" />
                <span className="text-[12px] leading-[1.45] text-muted-foreground">
                  {t(`changelog.planned.${n}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DataPanel>
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
      className="inline-flex max-w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-3 text-center text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
}

function TimelineItem({ entryKey, tags }: { entryKey: string; tags: string[] }) {
  const { t } = useI18n();
  const items = [1, 2, 3].map((n) => t(`${entryKey}.${n}`));

  return (
    <DataPanel
      className="overflow-hidden"
      contentClassName="space-y-2 overflow-x-hidden border-l-2 border-l-accent/35 p-3 pl-4 lg:px-4 lg:py-3 lg:pl-5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-mono text-[11px] font-semibold text-accent">
          {t(`${entryKey}.version`)}
        </span>
        <span className="text-xs text-subtle-foreground">|</span>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="neutral" className="px-1.5 py-0.5">
              {t(tag)}
            </Badge>
          ))}
        </div>
      </div>

      <h4 className="font-mono text-[13px] font-semibold text-foreground">
        {t(`${entryKey}.title`)}
      </h4>

      <ul className="space-y-1.5 text-[13px] leading-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle-foreground" />
            {item}
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}
