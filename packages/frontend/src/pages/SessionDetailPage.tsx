import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, Brain, FileCode2, MessageSquare, Terminal, Wrench } from 'lucide-react';
import { BrandBadge, BrandMark } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { DataQualityMatrix, type DataQualityState } from '../components/ui/DataQualityMatrix.js';
import { DataPanel } from '../components/ui/DataPanel.js';
import { TokenUsageBar } from '../components/session/TokenUsageBar.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { FigurePanel } from '../components/ui/FigurePanel.js';
import { DetailPageSkeleton } from '../components/ui/LoadingState.js';
import { MetricBlock } from '../components/ui/MetricBlock.js';
import { Sensitive } from '../components/ui/Sensitive.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import {
  basename,
  compactPath,
  formatCost,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatTokens,
} from '../lib/format.js';

interface Message {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

interface UsageEvent {
  id: number;
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  tool_calls_count: number;
}

interface SessionDetail {
  id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  source_path?: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  total_cost_usd: number | null;
  cost_source: 'actual' | 'estimated' | 'unknown';
  source_confidence: string;
  message_count: number;
  tool_call_count: number;
  raw_tool_call_count?: number;
  session_id: string;
  project_exists: boolean;
  data_quality?: SessionDataQuality | null;
  messages: Message[];
  usageEvents: UsageEvent[];
  modelUsage?: ModelUsage[];
  tools?: ToolEvent[];
  files?: FileEvent[];
}

interface ModelUsage {
  provider: string;
  model: string;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  tool_calls_count: number;
  total_cost_usd: number;
}

interface SessionDataQuality {
  messages: 'real' | 'partial' | 'unavailable';
  tokens: 'real' | 'estimated' | 'unavailable';
  cost: 'actual' | 'estimated' | 'unknown';
  tools: 'real' | 'partial' | 'unavailable';
  files: 'real' | 'heuristic' | 'unavailable';
  model: 'real' | 'inferred' | 'unknown';
  projectPath: 'real' | 'inferred' | 'unknown';
}

interface ToolEvent {
  id: number;
  timestamp: string;
  tool_name: string;
  operation: string;
  output_preview?: string | null;
  source_confidence: 'high' | 'medium' | 'low';
}

interface FileEvent {
  id: number;
  path?: string | null;
  operation: 'read' | 'write' | 'edit' | 'delete' | 'shell_possible' | 'unknown';
  tool_name?: string | null;
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
}

export function SessionDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [openingProject, setOpeningProject] = useState(false);
  const {
    data: session,
    loading,
    validating,
    error,
    refetch,
  } = useApi<SessionDetail>(id ? `/api/sessions/${id}` : null, { immediate: Boolean(id) });

  if (loading && !session) return <DetailPageSkeleton />;

  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState
          title={error.status === 404 ? t('session.notFound') : t('session.unable')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!session)
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title={t('session.notFound')}
          description={t('session.notFound.description')}
          icon={MessageSquare}
        />
      </div>
    );

  const messages = session.messages ?? [];
  const usageEvents = session.usageEvents ?? [];
  const totalInput = usageEvents.reduce((sum, event) => sum + (event.input_tokens ?? 0), 0);
  const totalOutput = usageEvents.reduce((sum, event) => sum + (event.output_tokens ?? 0), 0);
  const cacheRead = usageEvents.reduce((sum, event) => sum + (event.cache_read_tokens ?? 0), 0);
  const cacheWrite = usageEvents.reduce((sum, event) => sum + (event.cache_write_tokens ?? 0), 0);
  const reasoning = usageEvents.reduce((sum, event) => sum + (event.reasoning_tokens ?? 0), 0);
  const totalTokens = totalInput + totalOutput + cacheRead + cacheWrite + reasoning;
  const modelUsage = session.modelUsage ?? [];
  const tools = session.tools ?? [];
  const files = session.files ?? [];
  const qualityItems = [
    {
      label: t('common.messages'),
      state: normalizeQuality(session.data_quality?.messages),
      detail: `${messages.length} ${t('common.messages').toLowerCase()}`,
    },
    {
      label: t('common.tokens'),
      state: normalizeQuality(session.data_quality?.tokens),
      detail: formatTokens(totalTokens),
    },
    {
      label: t('common.cost'),
      state: normalizeQuality(session.data_quality?.cost),
      detail: t(`common.${session.cost_source}`),
    },
    {
      label: t('common.tools'),
      state: normalizeQuality(session.data_quality?.tools),
      detail: `${tools.length} events / ${session.tool_call_count ?? 0} total`,
    },
    {
      label: t('common.files'),
      state: normalizeQuality(session.data_quality?.files),
      detail: `${files.length} ${t('common.files').toLowerCase()}`,
    },
    {
      label: t('common.model'),
      state: normalizeQuality(session.data_quality?.model),
      detail: session.model ?? t('common.unknown'),
    },
  ];

  async function openProject() {
    if (!id || !session?.project_exists) return;
    setOpeningProject(true);
    try {
      await fetch(`/api/sessions/${id}/open-project`, { method: 'POST' });
    } finally {
      setOpeningProject(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6" aria-busy={validating}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <ArrowLeft className="h-4 w-4" /> {t('session.back')}
        </Link>
        <Badge
          variant={
            session.source_confidence === 'HIGH'
              ? 'success'
              : session.source_confidence === 'MEDIUM'
                ? 'default'
                : 'warning'
          }
        >
          {t(`common.confidence.${session.source_confidence.toLowerCase()}`)}
        </Badge>
      </div>

      <FigurePanel
        figure="FORENSICS"
        title={`${t('common.session')} ${session.session_id.slice(0, 12)}`}
        description={compactPath(session.project_path)}
        meta={
          <Badge
            variant={
              session.source_confidence === 'HIGH'
                ? 'success'
                : session.source_confidence === 'MEDIUM'
                  ? 'default'
                  : 'warning'
            }
          >
            {t(`common.confidence.${session.source_confidence.toLowerCase()}`)}
          </Badge>
        }
        action={
          <Button
            variant="outline"
            onClick={openProject}
            disabled={!session.project_exists || openingProject}
          >
            {openingProject
              ? t('session.opening')
              : session.project_exists
                ? t('session.openFolder')
                : t('session.folderMissing')}
          </Button>
        }
        contentClassName="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <BrandMark value={session.cli} size="lg" />
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <BrandBadge value={session.cli} />
                <BrandBadge value={session.provider} kind="provider" />
                {reasoning > 0 && (
                  <Badge variant="info">
                    <Brain className="h-3 w-3" /> {t('session.extendedThinking')}
                  </Badge>
                )}
                <span className="text-xs text-subtle-foreground">
                  {formatRelativeTime(session.started_at)}
                </span>
              </div>
              <div className="font-mono text-sm text-muted-foreground">{session.session_id}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MetricBlock
            variant="compact"
            label={
              session.cost_source === 'estimated' ? t('session.costEstimated') : t('common.cost')
            }
            value={<Sensitive>{formatCost(session.total_cost_usd, session.cost_source)}</Sensitive>}
            meta={
              session.cost_source === 'unknown' ? (
                <span className="text-xs text-muted-foreground">
                  {t('common.unknown')} &mdash; {t('session.costUnavailableHint')}
                </span>
              ) : (
                t(`common.${session.cost_source}`)
              )
            }
            tone={session.cost_source === 'unknown' ? 'default' : 'success'}
          />
          <MetricBlock
            variant="compact"
            label={t('common.tokens')}
            value={formatTokens(totalTokens)}
            meta={t('dashboard.allSources')}
          />
          <MetricBlock
            variant="compact"
            label={t('common.messages')}
            value={String(session.message_count ?? messages.length)}
            meta={t('session.normalizedMessages')}
          />
          <MetricBlock
            variant="compact"
            label={t('common.tools')}
            value={String(session.tool_call_count ?? 0)}
            meta={
              session.raw_tool_call_count && session.raw_tool_call_count > 0
                ? `${session.raw_tool_call_count} raw`
                : t('common.tools').toLowerCase()
            }
            tone="warning"
          />
          <MetricBlock
            variant="compact"
            label={t('common.duration')}
            value={formatDuration(session.duration_ms)}
            meta={t('common.activity')}
          />
          <MetricBlock
            variant="compact"
            label={t('common.model')}
            value={session.model ?? t('common.unknown')}
            meta={session.provider}
            tone="warning"
          />
        </div>
      </FigurePanel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <FigurePanel
          figure="TIMELINE 01"
          className="min-w-0"
          title={t('session.conversation')}
          description={`${messages.length} ${t('session.normalizedMessages')}`}
          contentClassName="p-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0"
        >
          <div className="h-[260vh] overflow-y-auto over p-4">
            <div className="space-y-3 rounded-md border border-border bg-surface-muted/40 p-3">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {messages.length === 0 && (
                <EmptyState
                  title={t('session.noMessages.title')}
                  description={t('session.noMessages.description')}
                  icon={MessageSquare}
                />
              )}
            </div>
          </div>
        </FigurePanel>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <FigurePanel
            figure="MATRIX"
            title={t('session.dataQuality')}
            description="Evidence availability for this local source."
            contentClassName="pt-4"
          >
            <DataQualityMatrix items={qualityItems} />
          </FigurePanel>

          {modelUsage.length > 1 && (
            <FigurePanel
              figure="FIG. 01"
              title={t('session.modelsUsed')}
              contentClassName="flex flex-col gap-3 pt-3"
            >
              {modelUsage.map((item) => (
                <div
                  key={`${item.provider}/${item.model}`}
                  className="rounded-md border border-border bg-surface-elevated p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {item.provider}/{item.model}
                      </div>
                      <div className="text-xs text-subtle-foreground">
                        {item.message_count} {t('common.messages').toLowerCase()}
                      </div>
                    </div>
                    <Badge variant="neutral">
                      <Sensitive>{formatCurrency(item.total_cost_usd)}</Sensitive>
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-subtle-foreground">
                    <DetailMetric
                      label={t('common.input')}
                      value={formatTokens(item.input_tokens)}
                    />
                    <DetailMetric
                      label={t('common.output')}
                      value={formatTokens(item.output_tokens)}
                    />
                    <DetailMetric
                      label={t('common.reasoning')}
                      value={formatTokens(item.reasoning_tokens)}
                    />
                    <DetailMetric label={t('common.tools')} value={String(item.tool_calls_count)} />
                  </div>
                </div>
              ))}
            </FigurePanel>
          )}

          <FigurePanel
            figure="FIG. 02"
            title={t('session.tokenUsage')}
            contentClassName="space-y-5 pt-3"
          >
            <TokenUsageBar
              input={totalInput}
              output={totalOutput}
              cacheRead={cacheRead}
              cacheWrite={cacheWrite}
              reasoning={reasoning}
            />
          </FigurePanel>

          <DataPanel title="Evidence trail" contentClassName="space-y-3 pt-3 text-sm">
            <DetailRow
              label={t('session.sourcePath')}
              value={compactPath(session.source_path ?? null) || '—'}
            />
            <DetailRow
              label={t('common.messages')}
              value={formatQualityValue(t, session.data_quality?.messages)}
            />
            <DetailRow
              label={t('common.tokens')}
              value={formatQualityValue(t, session.data_quality?.tokens)}
            />
            <DetailRow
              label={t('common.cost')}
              value={formatQualityValue(t, session.data_quality?.cost)}
            />
            <DetailRow
              label={t('common.tools')}
              value={formatQualityValue(t, session.data_quality?.tools)}
            />
            <DetailRow
              label={t('common.files')}
              value={formatQualityValue(t, session.data_quality?.files)}
            />
            <DetailRow
              label={t('common.model')}
              value={formatQualityValue(t, session.data_quality?.model)}
            />
            <DetailRow
              label={t('common.project')}
              value={formatQualityValue(t, session.data_quality?.projectPath)}
            />
          </DataPanel>

          <FigurePanel
            figure="TOOLS"
            title={t('session.toolsCaptured')}
            description={`${tools.length} ${t('common.tools').toLowerCase()}`}
            contentClassName="space-y-2 pt-3"
          >
            {tools.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="rounded-md border border-border bg-surface-elevated p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <Wrench className="h-3.5 w-3.5 text-subtle-foreground" />
                          <span className="truncate">{tool.tool_name}</span>
                        </div>
                        <div className="mt-1 text-xs text-subtle-foreground">
                          {tool.operation} · {formatDateTime(tool.timestamp)}
                        </div>
                      </div>
                      <Badge variant={tool.source_confidence === 'high' ? 'success' : 'neutral'}>
                        {tool.source_confidence}
                      </Badge>
                    </div>
                    {tool.output_preview && (
                      <pre className="mt-3 whitespace-pre-wrap break-words rounded-md border border-border bg-surface px-2.5 py-2 font-sans text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {tool.output_preview}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t('session.noTools.title')}
                description={t('session.noTools.description')}
                icon={Wrench}
              />
            )}
          </FigurePanel>

          <FigurePanel
            figure="FILES"
            title={t('session.filesTouched')}
            description={`${files.length} ${t('common.files').toLowerCase()}`}
            contentClassName="space-y-2 pt-3"
          >
            {files.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-md border border-border bg-surface-elevated p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <FileCode2 className="h-3.5 w-3.5 text-subtle-foreground" />
                          <span className="truncate">
                            {compactPath(file.path ?? null) || t('common.unknown')}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-subtle-foreground">
                          {file.operation} · {file.tool_name ?? t('common.unknown')} ·{' '}
                          {formatDateTime(file.timestamp)}
                        </div>
                      </div>
                      <Badge variant={file.confidence === 'high' ? 'success' : 'neutral'}>
                        {file.confidence}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t('session.noFiles.title')}
                description={t('session.noFiles.description')}
                icon={FileCode2}
              />
            )}
          </FigurePanel>

          <DataPanel title={t('session.metadata')} contentClassName="space-y-3 pt-3 text-sm">
            <DetailRow label={t('common.project')} value={basename(session.project_path)} />
            <DetailRow label={t('common.path')} value={compactPath(session.project_path)} />
            <DetailRow
              label={t('session.sourcePath')}
              value={compactPath(session.source_path ?? null) || '—'}
            />
            <DetailRow label={t('common.cli')} value={session.cli} />
            <DetailRow label={t('common.provider')} value={session.provider} />
            <DetailRow label={t('common.model')} value={session.model ?? t('common.unknown')} />
            <DetailRow
              label={t('session.costSource')}
              value={t(`common.${session.cost_source ?? 'unknown'}`)}
            />
            <DetailRow label={t('common.started')} value={formatDateTime(session.started_at)} />
            <DetailRow
              label={t('common.ended')}
              value={session.ended_at ? formatDateTime(session.ended_at) : '—'}
            />
            <DetailRow label={t('common.date')} value={formatDate(session.started_at)} />
            <DetailRow label={t('session.sessionId')} value={session.session_id} mono />
          </DataPanel>
        </aside>
      </div>
    </div>
  );
}

function formatQualityValue(
  t: ReturnType<typeof useI18n>['t'],
  value: string | null | undefined,
): string {
  switch (value) {
    case 'real':
      return t('common.real');
    case 'partial':
      return t('common.partial');
    case 'unavailable':
      return t('common.unavailable');
    case 'actual':
      return t('common.actual');
    case 'estimated':
      return t('common.estimated');
    case 'unknown':
      return t('common.unknown');
    case 'inferred':
      return t('common.inferred');
    case 'heuristic':
      return t('common.heuristic');
    default:
      return '—';
  }
}

function normalizeQuality(value: string | null | undefined): DataQualityState {
  switch (value) {
    case 'real':
    case 'actual':
      return 'real';
    case 'partial':
    case 'inferred':
      return 'partial';
    case 'estimated':
      return 'estimated';
    case 'heuristic':
      return 'heuristic';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <div className="text-[10px] uppercase text-subtle-foreground">{label}</div>
      <div className="mt-1 font-mono font-medium text-foreground">{value}</div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const Icon = isUser ? Terminal : Bot;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-elevated text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className={`max-w-[min(780px,92%)] ${isUser ? 'order-first' : ''}`}>
        <div
          className={
            isUser
              ? 'rounded-md border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-foreground'
              : isAssistant
                ? 'rounded-md border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground shadow-[var(--shadow-card)]'
                : 'rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground'
          }
        >
          <div className="mb-2 flex items-center justify-between gap-4 text-[11px]">
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 uppercase tracking-wide text-subtle-foreground">
              {message.role}
            </span>
            <span className="text-subtle-foreground">{formatDateTime(message.timestamp)}</span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 [overflow-wrap:anywhere]">
            {message.content}
          </pre>
        </div>
      </div>
      {isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-accent/20 bg-accent-soft text-accent">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={`min-w-0 text-right font-mono font-medium text-foreground ${mono ? 'break-all text-xs' : 'truncate'}`}
      >
        {value}
      </span>
    </div>
  );
}
