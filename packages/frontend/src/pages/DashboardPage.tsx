import { useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  MessageSquare,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useApi } from '../hooks/useApi.js';
import { StatCard } from '../components/StatCard.js';
import { formatCurrency, formatTokens } from '../lib/format.js';
import { Card, CardContent, CardHeader } from '../components/ui/Card.js';

const COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed'];

interface Overview {
  todaySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  totalSpend: number;
  sessionCount: number;
  averageSessionCost: number;
  mostUsedCli: string | null;
}

export function DashboardPage() {
  const { data: overview, loading } = useApi<Overview>('/api/overview');

  const { data: spendData } = useApi<{ points: { date: string; spend: number; tokens: number; sessions: number }[] }>('/api/analytics/spend-over-time');
  const { data: tokenData } = useApi<{ points: { date: string; inputTokens: number; outputTokens: number }[] }>('/api/analytics/tokens-over-time');
  const { data: breakdownData } = useApi<{ breakdown: { label: string; value: number; percentage: number }[] }>('/api/analytics/breakdown?dimension=model&metric=cost');

  const chartData = useMemo(() => spendData?.points ?? [], [spendData]);
  const tokenChartData = useMemo(() => tokenData?.points ?? [], [tokenData]);
  const pieData = useMemo(() => (breakdownData?.breakdown ?? []).filter((d) => d.value > 0), [breakdownData]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-tertiary">Overview of your AI coding activity</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Today" value={formatCurrency(overview?.todaySpend)} icon={DollarSign} loading={loading} subtitle="spend" />
        <StatCard label="This Month" value={formatCurrency(overview?.monthlySpend)} icon={Calendar} loading={loading} subtitle="spend" />
        <StatCard label="Sessions" value={String(overview?.sessionCount ?? 0)} icon={MessageSquare} loading={loading} />
        <StatCard label="Avg Cost" value={formatCurrency(overview?.averageSessionCost)} icon={TrendingUp} loading={loading} subtitle="per session" />
        <StatCard label="Top CLI" value={overview?.mostUsedCli ?? '—'} icon={Zap} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-sm font-medium text-text-primary">Spend Over Time</h3></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spend']}
                />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="rgba(99,102,241,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-medium text-text-primary">Tokens Over Time</h3></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={tokenChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => formatTokens(v)} />
                <Tooltip
                  contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="inputTokens" stroke="#818cf8" strokeWidth={2} dot={false} name="Input" />
                <Line type="monotone" dataKey="outputTokens" stroke="#22c55e" strokeWidth={2} dot={false} name="Output" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-medium text-text-primary">Model Distribution</h3></CardHeader>
          <CardContent className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-xs">
              {pieData.map((d, i) => (
                <div key={d.label} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-text-secondary">{d.label}</span>
                  <span className="text-text-primary font-medium">{d.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-medium text-text-primary">Spend vs Sessions</h3></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="spend" fill="#6366f1" radius={[4, 4, 0, 0]} name="Spend" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
