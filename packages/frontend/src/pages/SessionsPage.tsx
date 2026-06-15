import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import { BrandBadge, BrandMark } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { ControlField } from '../components/ui/ControlField.js';
import { Card, CardContent } from '../components/ui/Card.js';
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
import { FigurePanel } from '../components/ui/FigurePanel.js';
import { Input } from '../components/ui/Input.js';
import { TableSkeletonRows } from '../components/ui/LoadingState.js';
import { MetricBlock } from '../components/ui/MetricBlock.js';
import { Sensitive } from '../components/ui/Sensitive.js';
import { QueryBar } from '../components/ui/QueryBar.js';
import { Select } from '../components/ui/Select.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import {
  basename,
  compactPath,
  formatCost,
  formatCurrency,
  formatDuration,
  formatRelativeTime,
} from '../lib/format.js';

interface SessionRow {
  id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  duration_ms: number | null;
  total_cost_usd: number | null;
  cost_source: 'actual' | 'estimated' | 'unknown';
  source_confidence: string;
  message_count: number;
  tool_call_count: number;
  session_id: string;
  fts_snippet?: string;
}

export function SessionsPage() {
  const { t } = useI18n();
  const { queryString } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const cli = searchParams.get('cli') || '';
  const sortBy = searchParams.get('sortBy') || 'started_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const [searchInput, setSearchInput] = useState(search);

  const apiUrl = `/api/sessions?page=${page}&limit=20&sortBy=${sortBy}&sortOrder=${sortOrder}${search ? `&search=${search}` : ''}${cli ? `&cli=${cli}` : ''}${queryString ? `&${queryString}` : ''}`;
  const { data, loading, validating, error, refetch } = useApi<{
    data: SessionRow[];
    total: number;
    page: number;
    limit: number;
  }>(apiUrl);
  const isInitialLoading = loading && !data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const currentRows = data?.data ?? [];
  const currentSpend = currentRows.reduce(
    (sum, session) => sum + Number(session.total_cost_usd ?? 0),
    0,
  );
  const activeChips = [
    search
      ? {
          key: 'search',
          label: `${t('common.search')}: ${search}`,
          onClear: () => updateParam('search', ''),
        }
      : null,
    cli
      ? { key: 'cli', label: `${t('common.cli')}: ${cli}`, onClear: () => updateParam('cli', '') }
      : null,
    sortBy !== 'started_at' || sortOrder !== 'desc'
      ? { key: 'sort', label: `${t('common.sort')}: ${sortBy} ${sortOrder}` }
      : null,
  ].filter(Boolean) as { key: string; label: string; onClear?: () => void }[];

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (cli) params.set('cli', cli);
    if (queryString) {
      new URLSearchParams(queryString).forEach((v, k) => params.set(k, v));
    }
    const url = `/api/export/sessions.csv?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sessions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function updateParam(key: string, value: string, resetPage = true) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (resetPage) params.set('page', '1');
    setSearchParams(params);
  }

  function handleSort(column: string) {
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', column);
    params.set('sortOrder', sortBy === column && sortOrder === 'desc' ? 'asc' : 'desc');
    setSearchParams(params);
  }

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      {error && (
        <ErrorState
          title={t('sessions.failed')}
          message={error.message}
          code={error.code}
          details={error.details}
          onRetry={refetch}
        />
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <MetricBlock
          variant="compact"
          label={t('sessions.ledger')}
          value={String(data?.total ?? 0)}
          meta={validating && !isInitialLoading ? t('common.loading') : t('common.sessions')}
        />
        <MetricBlock
          variant="compact"
          label={t('common.cost')}
          value={<Sensitive>{formatCurrency(currentSpend)}</Sensitive>}
          tone="info"
          meta={t('sessions.currentPage')}
        />
        <MetricBlock
          variant="compact"
          label={t('common.confidence')}
          value={String(
            currentRows.filter((session) => session.source_confidence === 'HIGH').length,
          )}
          tone="success"
          meta={t('sessions.highConfidenceRows')}
        />
      </section>

      <QueryBar
        title={t('sessions.explorerTitle')}
        description={t('sessions.explorerDescription')}
        chips={activeChips}
        actions={
          <Button variant="command" onClick={() => updateParam('search', searchInput)}>
            {t('common.search')}
          </Button>
        }
      >
        <ControlField label={t('common.search')} className="md:col-span-2 xl:col-span-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && updateParam('search', searchInput)}
              placeholder={t('sessions.search.placeholder')}
              className="h-10 pl-9"
            />
          </div>
        </ControlField>
        <ControlField label={t('common.cli')}>
          <Select
            className="h-10"
            value={cli}
            onChange={(event) => updateParam('cli', event.target.value)}
            options={[
              { label: t('sessions.allClis'), value: '' },
              { label: 'Codex', value: 'codex' },
              { label: 'OpenCode', value: 'opencode' },
              { label: 'Claude', value: 'claude' },
              { label: 'Gemini', value: 'gemini' },
              { label: 'Kimi', value: 'kimi' },
              { label: 'Aider', value: 'aider' },
              { label: 'Qwen', value: 'qwen' },
              { label: 'Antigravity', value: 'antigravity' },
              { label: 'CommandCode', value: 'commandcode' },
            ]}
          />
        </ControlField>
      </QueryBar>

      <FigurePanel
        figure="LEDGER 02"
        title={t('topbar.sessions.title')}
        description={t('topbar.sessions.subtitle')}
        meta={
          <Badge variant="neutral">
            {validating && !isInitialLoading ? t('common.loading') : `${page}/${totalPages}`}
          </Badge>
        }
        action={
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            {t('common.exportCsv')} <Download className="ml-1 h-4 w-4" />
          </Button>
        }
        contentClassName="p-0"
        aria-busy={validating}
      >
        <DataTableContainer className="hidden md:block">
          <DataTable density="compact">
            <DataTableHead className="sticky top-0 z-10 bg-surface">
              <DataTableRow className="hover:bg-transparent">
                <HeaderCell onClick={() => handleSort('started_at')}>
                  {t('common.session')}
                </HeaderCell>
                <DataTableHeaderCell>{t('common.cli')}</DataTableHeaderCell>
                <HeaderCell onClick={() => handleSort('model')}>{t('common.model')}</HeaderCell>
                <DataTableHeaderCell>{t('common.project')}</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  {t('common.activity')}
                </DataTableHeaderCell>
                <HeaderCell align="right" onClick={() => handleSort('total_cost_usd')}>
                  {t('common.cost')}
                </HeaderCell>
                <DataTableHeaderCell className="text-right">
                  {t('common.confidence')}
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {isInitialLoading ? (
                <TableSkeletonRows rows={8} columns={7} />
              ) : (
                data?.data.map((session) => (
                  <DataTableRow key={session.id}>
                    <DataTableCell>
                      <Link
                        to={`/sessions/${session.id}`}
                        className="group flex items-center gap-3"
                      >
                        <BrandMark
                          value={session.cli}
                          size="md"
                          className="group-hover:border-accent/30"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground group-hover:text-accent">
                            {session.session_id.slice(0, 10)}
                          </div>
                          <div className="text-xs text-subtle-foreground">
                            {formatRelativeTime(session.started_at)}
                          </div>
                          {session.fts_snippet && (
                            <div className="mt-0.5 max-w-[220px] truncate text-[10px] italic text-subtle-foreground">
                              <FtsSnippet text={session.fts_snippet} />
                            </div>
                          )}
                        </div>
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <BrandBadge value={session.cli} />
                    </DataTableCell>
                    <DataTableCell className="max-w-[220px] font-mono text-xs text-muted-foreground">
                      {session.model ?? t('common.unknown')}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="text-sm font-medium text-foreground">
                        {basename(session.project_path)}
                      </div>
                      <div className="text-xs text-subtle-foreground">
                        {compactPath(session.project_path)}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono text-xs text-muted-foreground">
                      <div>{formatDuration(session.duration_ms)}</div>
                      <div>
                        {session.message_count} {t('common.messagesShort')} ·{' '}
                        {session.tool_call_count} {t('common.tools').toLowerCase()}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                      <div>
                        <Sensitive>
                          {formatCost(session.total_cost_usd, session.cost_source)}
                        </Sensitive>
                      </div>
                      {session.cost_source === 'estimated' && (
                        <div className="mt-1 text-[10px] uppercase text-warning">
                          {t('common.estimated')}
                        </div>
                      )}
                      {session.cost_source === 'unknown' && (
                        <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                          {t('common.unknown')}
                        </div>
                      )}
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
                        {t(`common.confidence.${session.source_confidence.toLowerCase()}`)}
                      </Badge>
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableContainer>

        <div className="grid gap-3 p-3 md:hidden">
          {isInitialLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} variant="flat">
                  <CardContent className="h-32 animate-pulse" />
                </Card>
              ))
            : currentRows.map((session) => (
                <Link key={session.id} to={`/sessions/${session.id}`}>
                  <Card interactive variant="flat">
                    <CardContent className="flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <BrandMark value={session.cli} size="md" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">
                              {session.session_id.slice(0, 10)}
                            </div>
                            <div className="text-xs text-subtle-foreground">
                              {formatRelativeTime(session.started_at)}
                            </div>
                            {session.fts_snippet && (
                              <div className="mt-0.5 truncate text-[10px] italic text-subtle-foreground">
                                <FtsSnippet text={session.fts_snippet} />
                              </div>
                            )}
                          </div>
                        </div>
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
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {session.model ?? t('common.unknown')}
                        </div>
                        <div className="mt-1 truncate text-xs text-subtle-foreground">
                          {compactPath(session.project_path)}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <MobileMetric
                          label={t('common.cost')}
                          value={
                            <Sensitive>
                              {formatCost(session.total_cost_usd, session.cost_source)}
                            </Sensitive>
                          }
                        />
                        <MobileMetric
                          label={t('common.duration')}
                          value={formatDuration(session.duration_ms)}
                        />
                        <MobileMetric
                          label={t('common.tools')}
                          value={String(session.tool_call_count)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>

        {!isInitialLoading && !error && (data?.data.length ?? 0) === 0 && (
          <div className="p-5">
            <EmptyState
              title={t('sessions.empty.title')}
              description={t('sessions.empty.description')}
              icon={Search}
            />
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="text-xs text-subtle-foreground sm:text-left">
            {t('common.page')} {page} {t('common.of')} {totalPages} · {data?.total ?? 0}{' '}
            {t('common.sessions').toLowerCase()}
            {validating && !isInitialLoading ? ` · ${t('common.loading')}` : ''}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={page <= 1}
              onClick={() => updateParam('page', String(page - 1), false)}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={page >= totalPages}
              onClick={() => updateParam('page', String(page + 1), false)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      </FigurePanel>
    </div>
  );
}

function HeaderCell({
  children,
  align = 'left',
  onClick,
}: {
  children: string;
  align?: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <DataTableHeaderCell className={align === 'right' ? 'text-right' : 'text-left'}>
      <button
        className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        onClick={onClick}
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </DataTableHeaderCell>
  );
}

function MobileMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface-muted p-2">
      <div className="text-[10px] uppercase text-subtle-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

function FtsSnippet({ text }: { text: string }) {
  const parts = text.split(/(\[\[.*?\]\])/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[[') && part.endsWith(']]') ? (
          <mark key={i} className="rounded-sm bg-accent/20 px-0.5 not-italic text-accent">
            {part.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
