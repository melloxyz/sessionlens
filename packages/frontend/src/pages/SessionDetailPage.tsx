import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, DollarSign, Zap, FolderOpen } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime, formatDuration, formatTokens } from '../lib/format.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';

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

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, loading } = useApi<Record<string, unknown>>(`/api/sessions/${id}`);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-bg-elevated" />
        <div className="h-40 animate-pulse rounded-xl bg-bg-secondary" />
      </div>
    );
  }

  if (!session) return <div className="p-6 text-text-tertiary">Session not found</div>;

  const messages = (session.messages ?? []) as Message[];
  const usageEvents = (session.usageEvents ?? []) as UsageEvent[];
  const totalInput = usageEvents.reduce((sum, e) => sum + (e.input_tokens ?? 0), 0);
  const totalOutput = usageEvents.reduce((sum, e) => sum + (e.output_tokens ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <Link to="/sessions" className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to sessions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Session {(session.session_id as string)?.substring(0, 8)}...</h1>
          <p className="text-sm text-text-tertiary">{session.project_path as string ?? 'Unknown project'}</p>
        </div>
        <Badge variant={session.source_confidence === 'HIGH' ? 'success' : session.source_confidence === 'MEDIUM' ? 'default' : 'warning'}>
          {session.source_confidence as string}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricBadge icon={DollarSign} label="Cost" value={formatCurrency(session.total_cost_usd as number)} />
        <MetricBadge icon={Zap} label="Model" value={session.model as string ?? '—'} />
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(session.duration_ms as number)} />
        <MetricBadge icon={FolderOpen} label="Messages" value={String(session.message_count ?? 0)} />
        <MetricBadge label="Input" value={formatTokens(totalInput)} />
        <MetricBadge label="Output" value={formatTokens(totalOutput)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Conversation</h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-accent text-white'
                      : msg.role === 'assistant'
                        ? 'bg-bg-elevated text-text-primary border border-border-secondary'
                        : 'bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-words font-sans">{msg.content}</pre>
                  <span className="mt-1 block text-right text-[10px] opacity-50">
                    {formatDateTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-text-tertiary py-8 text-center">No messages in this session</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Usage</h2>
          <Card>
            <CardContent className="space-y-3 text-sm">
              {usageEvents.length === 0 ? (
                <p className="text-text-tertiary">No usage data</p>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-text-secondary">Input tokens</span><span className="text-text-primary tabular-nums">{formatTokens(totalInput)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Output tokens</span><span className="text-text-primary tabular-nums">{formatTokens(totalOutput)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Cache read</span><span className="text-text-primary tabular-nums">{formatTokens(usageEvents.reduce((s, e) => s + (e.cache_read_tokens ?? 0), 0))}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Tool calls</span><span className="text-text-primary tabular-nums">{session.tool_call_count as number ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Session ID</span><span className="text-xs text-text-tertiary font-mono">{(session.session_id as string)?.substring(0, 12)}...</span></div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricBadge({ icon: Icon, label, value }: { icon?: typeof DollarSign; label: string; value: string }) {
  return (
    <Card className="border-border-secondary">
      <CardContent className="flex items-center gap-3 py-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
            <Icon className="h-4 w-4 text-accent-hover" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] text-text-tertiary uppercase tracking-wider">{label}</p>
          <p className="text-sm font-medium text-text-primary truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
