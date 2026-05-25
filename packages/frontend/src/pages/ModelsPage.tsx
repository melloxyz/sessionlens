import { useApi } from '../hooks/useApi.js';
import { Card, CardContent } from '../components/ui/Card.js';

interface ModelRow {
  id: number;
  provider: string;
  model_name: string;
  input_cost_per_million: number;
  output_cost_per_million: number;
  cached_input_cost: number | null;
}

export function ModelsPage() {
  const { data, loading } = useApi<{ data: ModelRow[] }>('/api/models');

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Model Pricing</h1>
        <p className="text-sm text-text-tertiary">Reference pricing table for cost estimation</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary text-text-tertiary">
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Model</th>
                  <th className="px-4 py-3 text-right font-medium">Input $/1M</th>
                  <th className="px-4 py-3 text-right font-medium">Output $/1M</th>
                  <th className="px-4 py-3 text-right font-medium">Cache $/1M</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border-secondary">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-bg-elevated" /></td>
                        ))}
                      </tr>
                    ))
                  : data?.data.map((m) => (
                      <tr key={m.id} className="border-b border-border-secondary hover:bg-bg-hover transition-colors">
                        <td className="px-4 py-3"><span className="text-xs font-medium uppercase text-text-secondary">{m.provider}</span></td>
                        <td className="px-4 py-3 text-text-primary font-mono text-xs">{m.model_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-primary">${m.input_cost_per_million.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-primary">${m.output_cost_per_million.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-text-tertiary">{m.cached_input_cost != null ? `$${m.cached_input_cost.toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
