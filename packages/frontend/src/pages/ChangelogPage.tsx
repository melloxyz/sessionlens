import { CheckCircle2, CircleDot, Clock3, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/Badge.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { SectionHeader } from '../components/ui/SectionHeader.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';

const latestKeys = ['changelog.latest.1', 'changelog.latest.2', 'changelog.latest.3'];
const latestTags = ['changelog.core', 'changelog.analytics', 'changelog.pricing'];

const releasedKeys = [
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

const inProgressKeys = [
  'changelog.inProgress.1',
  'changelog.inProgress.2',
  'changelog.inProgress.3',
];
const plannedKeys = ['changelog.planned.1', 'changelog.planned.2', 'changelog.planned.3'];

export function ChangelogPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <DataPanel contentClassName="space-y-5 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="gap-1.5">
                <Sparkles className="h-3 w-3" /> Sessionless
              </Badge>
              <Badge variant="success">{t('changelog.current')}</Badge>
            </div>
            <h2 className="mt-4 font-mono text-3xl font-semibold tracking-[-0.06em] text-foreground">
              {t('changelog.version')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('changelog.hero.description')}
            </p>
          </div>
          <a
            href="https://github.com/melloxyz/sessionless"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 font-mono text-xs font-medium text-accent transition-colors hover:border-border-strong hover:text-accent-hover"
          >
            <GitBranch className="h-4 w-4" /> github.com/melloxyz/sessionless
          </a>
        </div>
      </DataPanel>

      <section className="space-y-3">
        <SectionTitle
          title={t('changelog.latest')}
          description={t('changelog.latest.description')}
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {latestKeys.map((key, i) => (
            <DataPanel key={key} contentClassName="space-y-3 p-4">
              <Badge variant="neutral">{t(latestTags[i])}</Badge>
              <div className="font-mono text-sm font-medium text-foreground">
                {t(`${key}.text`)}
              </div>
            </DataPanel>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <SectionTitle
            title={t('changelog.released')}
            description={t('changelog.released.description')}
          />
          <div className="space-y-4">
            {releasedKeys.map((entry) => (
              <ReleaseCard key={entry.key} entryKey={entry.key} tags={entry.tags} />
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <RoadmapCard
            icon={Clock3}
            title={t('changelog.inProgress')}
            description={t('changelog.progress.description')}
            itemKeys={inProgressKeys}
            tone="warning"
          />
          <RoadmapCard
            icon={Layers3}
            title={t('changelog.planned')}
            description={t('changelog.planned.description')}
            itemKeys={plannedKeys}
            tone="info"
          />
          <DataPanel title={t('changelog.status.title')} contentClassName="space-y-3 text-sm">
            <StatusRow
              label={t('changelog.status.localFirst')}
              value={t('changelog.status.active')}
            />
            <StatusRow label={t('changelog.status.pricing')} value="OpenRouter" />
            <StatusRow label={t('changelog.status.name')} value="Sessionless" />
          </DataPanel>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <SectionHeader title={title} description={description} />;
}

function ReleaseCard({ entryKey, tags }: { entryKey: string; tags: string[] }) {
  const { t } = useI18n();
  const items = [1, 2, 3].map((n) => t(`${entryKey}.${n}`));
  return (
    <DataPanel contentClassName="grid gap-0 p-0 md:grid-cols-[160px_minmax(0,1fr)]">
      <div className="border-b border-border p-5 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {t(`${entryKey}.version`)}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="neutral">
              {t(tag)}
            </Badge>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="font-mono text-sm font-semibold text-foreground">
          {t(`${entryKey}.title`)}
        </div>
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item} className="flex gap-2 text-sm text-muted-foreground">
              <CircleDot className="mt-1 h-3 w-3 shrink-0 fill-accent text-accent" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </DataPanel>
  );
}

function RoadmapCard({
  icon: Icon,
  title,
  description,
  itemKeys,
  tone,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  itemKeys: string[];
  tone: 'warning' | 'info';
}) {
  const { t } = useI18n();
  const toneClass = tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info';
  return (
    <DataPanel
      title={title}
      description={description}
      contentClassName="space-y-2"
      action={
        <div className={`grid h-9 w-9 place-items-center rounded-md border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      }
    >
      {itemKeys.map((key) => (
        <div
          key={key}
          className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground"
        >
          {t(key)}
        </div>
      ))}
    </DataPanel>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 font-mono text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
