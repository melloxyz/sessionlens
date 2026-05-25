import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatTokens } from '../lib/format.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Select } from '../components/ui/Select.js';

const COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#22c55e', '#eab308', '#ef4444', '#ec4899'];

export function AnalyticsPage() {
  const [dimension, setDimension] = useState('model');
  const [metric, setMetric] = useState('cost');

  const { data: spendData } = useApi<{ points: { date: string; spend: number; tokens: number }[] }>('/api/analytics/spend-over-time?granularity=week');
  const { data: tokenData } = useApi<{ points: { date: string; inputTokens: number; outputTokens: number }[] }>('/api/analytics/tokens-over-time');
  const { data: breakdownData } = useApi<{ breakdown: { label: string; value: number; percentage: number }[] }>(`/api/analytics/breakdown?dimension=${dimension}&metric=${metric}`);

  const breakdown = useMemo(() => (breakdownData?.breakdown ?? []).filter((d) => d.value > 0), [breakdownData]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-tertiary">Deep dive into your AI usage patterns</p>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { label: 'By Model', value: 'model' },
            { label: 'By Provider', value: 'provider' },
            { label: 'By CLI', value: 'cli' },
            { label: 'By Project', value: 'project' },
          ]}
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
        />
        <Select
          options={[
            { label: 'Cost', value: 'cost' },
            { label: 'Sessions', value: 'sessions' },
            { label: 'Tokens', value: 'tokens' },
          ]}
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Weekly Spend</h3></div>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={spendData?.points ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spend']} />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="rgba(99,102,241,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Token Usage Over Time</h3></div>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={tokenData?.points ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => formatTokens(v)} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="inputTokens" stroke="#818cf8" fill="rgba(129,140,248,0.1)" strokeWidth={2} name="Input" />
                <Area type="monotone" dataKey="outputTokens" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} name="Output" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Breakdown</h3></div>
          <CardContent className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={55}>
                  {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [metric === 'cost' ? `$${v.toFixed(2)}` : formatTokens(v), '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-xs">
              {breakdown.map((d, i) => (
                <div key={d.label} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-text-secondary truncate max-w-[100px]">{d.label}</span>
                  <span className="text-text-primary font-medium ml-auto">{d.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 pb-0"><h3 className="text-sm font-medium text-text-primary">Top Projects Spend</h3></div>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={breakdown.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => metric === 'cost' ? `$${v.toFixed(0)}` : String(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#888' }} width={80} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
