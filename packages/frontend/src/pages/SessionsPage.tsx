import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ArrowUpDown } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDuration, formatDate } from '../lib/format.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';

interface SessionRow {
  id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  duration_ms: number | null;
  total_cost_usd: number | null;
  source_confidence: string;
  message_count: number;
  tool_call_count: number;
  session_id: string;
}

export function SessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'started_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const [searchInput, setSearchInput] = useState(search);

  const apiUrl = `/api/sessions?page=${page}&limit=20&sortBy=${sortBy}&sortOrder=${sortOrder}${search ? `&search=${search}` : ''}`;
  const { data, loading } = useApi<{ data: SessionRow[]; total: number; page: number; limit: number }>(apiUrl);

  function handleSort(col: string) {
    const params = new URLSearchParams(searchParams);
    if (sortBy === col) {
      params.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      params.set('sortBy', col);
      params.set('sortOrder', 'desc');
    }
    params.set('page', '1');
    setSearchParams(params);
  }

  function handleSearch() {
    const params = new URLSearchParams(searchParams);
    if (searchInput) params.set('search', searchInput);
    else params.delete('search');
    params.set('page', '1');
    setSearchParams(params);
  }

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Sessions</h1>
          <p className="text-sm text-text-tertiary">{data?.total ?? 0} sessions total</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search sessions..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-56"
          />
          <button
            onClick={handleSearch}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary text-text-tertiary">
                  <th className="cursor-pointer px-4 py-3 text-left font-medium hover:text-text-primary" onClick={() => handleSort('started_at')}>Date <ArrowUpDown className="inline h-3 w-3 ml-1" /></th>
                  <th className="px-4 py-3 text-left font-medium">CLI</th>
                  <th className="cursor-pointer px-4 py-3 text-left font-medium hover:text-text-primary" onClick={() => handleSort('model')}>Model</th>
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="cursor-pointer px-4 py-3 text-right font-medium hover:text-text-primary" onClick={() => handleSort('total_cost_usd')}>Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Duration</th>
                  <th className="px-4 py-3 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border-secondary">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-bg-elevated" /></td>
                        ))}
                      </tr>
                    ))
                  : data?.data.map((s) => (
                      <tr key={s.id} className="border-b border-border-secondary hover:bg-bg-hover transition-colors">
                        <td className="px-4 py-3 text-text-primary">
                          <Link to={`/sessions/${s.id}`} className="hover:text-accent-hover">{formatDate(s.started_at)}</Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium uppercase text-text-secondary">{s.cli}</span>
                        </td>
                        <td className="px-4 py-3 text-text-primary">{s.model ?? '—'}</td>
                        <td className="px-4 py-3 text-text-secondary truncate max-w-[180px]">{s.project_path?.split('\\').pop() ?? s.project_path ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-primary">{formatCurrency(s.total_cost_usd)}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">{formatDuration(s.duration_ms)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant={s.source_confidence === 'HIGH' ? 'success' : s.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>{s.source_confidence}</Badge>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-secondary px-4 py-3">
              <span className="text-xs text-text-tertiary">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  className="px-3 py-1 text-xs rounded border border-border-primary hover:bg-bg-hover disabled:opacity-30 transition-colors"
                  disabled={page <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('page', String(page - 1));
                    setSearchParams(params);
                  }}
                >
                  Prev
                </button>
                <button
                  className="px-3 py-1 text-xs rounded border border-border-primary hover:bg-bg-hover disabled:opacity-30 transition-colors"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('page', String(page + 1));
                    setSearchParams(params);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
