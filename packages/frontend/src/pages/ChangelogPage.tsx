import {
  CheckCircle2,
  CircleDot,
  GitBranch,
  Monitor,
  RadioTower,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge } from '../components/ui/Badge.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';

const releaseTimeline = [
  { key: 'changelog.released.13', tags: ['changelog.ui', 'changelog.analytics'] },
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
    <div className="mx-auto flex min-h-full w-full max-w-[1780px] flex-col gap-5 overflow-y-auto p-4 lg:p-6">
      <FigurePanel
        figure="RELEASE LOG"
        title={t('changelog.hero.title')}
        description={t('changelog.hero.description')}
        contentClassName="space-y-5 p-4 lg:p-5"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={
                    theme === 'dark' ? '/sessionlens-white-logo.png' : '/sessionlens-black-logo.png'
                  }
                  alt="Sessionlens"
                  className="h-12 w-12 shrink-0 rounded-md border border-border bg-surface"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-subtle-foreground">
                    Sessionlens
                  </div>
                  <div className="truncate text-base font-semibold text-foreground">
                    Sessionlens
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t('sidebar.controlPlane')}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{t('changelog.current')}</Badge>
                <Badge variant="neutral">{t('changelog.version')}</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground 2xl:text-[2rem]">
                {t('changelog.hero.title')}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('changelog.hero.description')}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <ActionLink href="https://github.com/melloxyz/sessionlens" icon={GitBranch}>
                {t('changelog.status.repository')}
              </ActionLink>
              <ActionLink
                href="https://github.com/melloxyz/sessionlens/releases"
                icon={CheckCircle2}
              >
                {t('changelog.status.releases')}
              </ActionLink>
              <ActionLink href="https://github.com/melloxyz/sessionlens/issues" icon={CircleDot}>
                {t('changelog.status.issues')}
              </ActionLink>
            </div>
          </div>

          <div className="grid gap-3">
            {statusCards.map((card) => (
              <StatusCard
                key={card.labelKey}
                icon={card.icon}
                label={t(card.labelKey)}
                value={t(card.valueKey)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <ReleaseHighlight key={item} index={item} text={t(`changelog.latest.${item}.text`)} />
          ))}
        </div>
      </FigurePanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FigurePanel
          figure="TIMELINE 01"
          title={t('changelog.timeline.title')}
          description={t('changelog.timeline.description')}
          contentClassName="space-y-3 p-4"
        >
          {releaseTimeline.map((entry) => (
            <TimelineItem key={entry.key} entryKey={entry.key} tags={entry.tags} />
          ))}
        </FigurePanel>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <DataPanel
            title={t('changelog.latest')}
            description={t('changelog.latest.description')}
            contentClassName="space-y-3 p-3"
          >
            {[1, 2, 3].map((item) => (
              <div key={item} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                <div className="text-[10px] font-semibold uppercase text-subtle-foreground">
                  0{item}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t(`changelog.latest.${item}.text`)}
                </p>
              </div>
            ))}
          </DataPanel>

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

          <DataPanel
            title={`${t('changelog.inProgress')} / ${t('changelog.planned')}`}
            description={t('changelog.progress.description')}
            contentClassName="space-y-4 p-3"
          >
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase text-amber-400">
                {t('changelog.inProgress')}
              </div>
              {[1, 2].map((item) => (
                <RoadmapItem key={`in-progress-${item}`} text={t(`changelog.inProgress.${item}`)} />
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="text-[10px] font-semibold uppercase text-subtle-foreground">
                {t('changelog.planned')}
              </div>
              {[1, 2, 3].map((item) => (
                <RoadmapItem key={`planned-${item}`} text={t(`changelog.planned.${item}`)} />
              ))}
            </div>
          </DataPanel>
        </aside>
      </div>
    </div>
  );
}

function ReleaseHighlight({ index, text }: { index: number; text: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <div className="text-[10px] font-semibold uppercase text-subtle-foreground">0{index}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-muted text-subtle-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
          <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ entryKey, tags }: { entryKey: string; tags: string[] }) {
  const { t } = useI18n();
  const items = [1, 2, 3].map((n) => t(`${entryKey}.${n}`));

  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-3">
      <div className="flex flex-col items-center">
        <span className="mt-2 h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="mt-2 h-full w-px bg-border" />
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" className="font-mono">
            {t(`${entryKey}.version`)}
          </Badge>
          {tags.map((tag) => (
            <Badge key={tag} variant="neutral" className="px-1.5 py-0.5">
              {t(tag)}
            </Badge>
          ))}
        </div>

        <h2 className="mt-3 text-base font-semibold text-foreground">{t(`${entryKey}.title`)}</h2>

        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle-foreground" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RoadmapItem({ text }: { text: string }) {
  return (
    <div className="flex gap-2 text-sm leading-6 text-muted-foreground">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle-foreground" />
      <span>{text}</span>
    </div>
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
