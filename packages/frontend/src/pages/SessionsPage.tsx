import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search } from 'lucide-react';
import { BrandBadge, BrandMark } from '../components/brand/BrandMark.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Input } from '../components/ui/Input.js';
import { TableSkeletonRows } from '../components/ui/LoadingState.js';
import { Select } from '../components/ui/Select.js';
import { useDateRange } from '../components/filters/DateRangeProvider.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useApi } from '../hooks/useApi.js';
import { basename, compactPath, formatCurrency, formatDuration, formatRelativeTime } from '../lib/format.js';

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
  const { data, loading, error, refetch } = useApi<{ data: SessionRow[]; total: number; page: number; limit: number }>(apiUrl);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

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
    <div className="space-y-5 p-6">
      {error && (
        <ErrorState title={t('sessions.failed')} message={error.message} code={error.code} details={error.details} onRetry={refetch} />
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && updateParam('search', searchInput)}
                placeholder={t('sessions.search.placeholder')}
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={() => updateParam('search', searchInput)}>{t('common.search')}</Button>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={cli}
              onChange={(event) => updateParam('cli', event.target.value)}
              options={[{ label: t('sessions.allClis'), value: '' }, { label: 'Codex', value: 'codex' }, { label: 'OpenCode', value: 'opencode' }, { label: 'Claude', value: 'claude' }, { label: 'Gemini', value: 'gemini' }, { label: 'Kimi', value: 'kimi' }, { label: 'Aider', value: 'aider' }, { label: 'Qwen', value: 'qwen' }]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle-foreground">
                  <HeaderCell onClick={() => handleSort('started_at')}>{t('common.session')}</HeaderCell>
                  <th className="px-5 py-3 text-left font-medium">CLI</th>
                  <HeaderCell onClick={() => handleSort('model')}>{t('common.model')}</HeaderCell>
                  <th className="px-5 py-3 text-left font-medium">{t('common.project')}</th>
                  <th className="px-5 py-3 text-right font-medium">Activity</th>
                  <HeaderCell align="right" onClick={() => handleSort('total_cost_usd')}>{t('common.cost')}</HeaderCell>
                  <th className="px-5 py-3 text-right font-medium">{t('common.confidence')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeletonRows rows={8} columns={7} /> : data?.data.map((session) => (
                  <tr key={session.id} className="border-b border-border transition-colors hover:bg-surface-hover">
                    <td className="px-5 py-4">
                      <Link to={`/sessions/${session.id}`} className="group flex items-center gap-3">
                        <BrandMark value={session.cli} size="md" className="group-hover:border-accent/30" />
                        <div>
                          <div className="font-medium text-foreground group-hover:text-accent">{session.session_id.slice(0, 10)}</div>
                          <div className="text-xs text-subtle-foreground">{formatRelativeTime(session.started_at)}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4"><BrandBadge value={session.cli} /></td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{session.model ?? 'unknown'}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{basename(session.project_path)}</div>
                      <div className="text-xs text-subtle-foreground">{compactPath(session.project_path)}</div>
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-muted-foreground">
                      <div>{formatDuration(session.duration_ms)}</div>
                      <div>{session.message_count} msgs · {session.tool_call_count} tools</div>
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums text-foreground">
                      <div>{formatCurrency(session.total_cost_usd)}</div>
                      {session.cost_source === 'estimated' && <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-warning">{t('common.estimated')}</div>}
                    </td>
                    <td className="px-5 py-4 text-right"><Badge variant={session.source_confidence === 'HIGH' ? 'success' : session.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>{session.source_confidence}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && !error && (data?.data.length ?? 0) === 0 && (
            <div className="p-5">
              <EmptyState title={t('sessions.empty.title')} description={t('sessions.empty.description')} icon={Search} />
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <div className="text-xs text-subtle-foreground">Showing page {page} of {totalPages} · {data?.total ?? 0} sessions</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1), false)}>{t('common.previous')}</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => updateParam('page', String(page + 1), false)}>{t('common.next')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeaderCell({ children, align = 'left', onClick }: { children: string; align?: 'left' | 'right'; onClick: () => void }) {
  return (
    <th className={`px-5 py-3 ${align === 'right' ? 'text-right' : 'text-left'} font-medium`}>
      <button className="inline-flex items-center gap-1 text-subtle-foreground transition-colors hover:text-foreground" onClick={onClick}>
        {children}<ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
