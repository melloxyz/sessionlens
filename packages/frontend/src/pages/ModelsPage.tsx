import { BrandBadge } from '../components/brand/BrandMark.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { TableSkeletonRows } from '../components/ui/LoadingState.js';
import { useApi } from '../hooks/useApi.js';

interface ModelRow {
  id: number;
  provider: string;
  model_name: string;
  input_cost_per_million: number;
  output_cost_per_million: number;
  cached_input_cost: number | null;
}

export function ModelsPage() {
  const { data, loading, error, refetch } = useApi<{ data: ModelRow[] }>('/api/models');

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title="Models failed to load" message={error.message} code={error.code} details={error.details} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle-foreground">
                  <th className="px-5 py-3 text-left font-medium">Provider</th>
                  <th className="px-5 py-3 text-left font-medium">Model</th>
                  <th className="px-5 py-3 text-right font-medium">Input $/1M</th>
                  <th className="px-5 py-3 text-right font-medium">Output $/1M</th>
                  <th className="px-5 py-3 text-right font-medium">Cache $/1M</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeletonRows rows={8} columns={5} /> : data?.data.map((model) => (
                  <tr key={model.id} className="border-b border-border transition-colors hover:bg-surface-hover">
                    <td className="px-5 py-4"><BrandBadge value={model.provider} kind="provider" /></td>
                    <td className="px-5 py-4 font-mono text-xs text-foreground">{model.model_name}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">${model.input_cost_per_million.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium text-foreground">${model.output_cost_per_million.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{model.cached_input_cost == null ? '—' : `$${model.cached_input_cost.toFixed(2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && (data?.data.length ?? 0) === 0 && (
            <div className="p-5">
              <EmptyState title="No model pricing found" description="Pricing rows will appear after seeds or configured models are available." />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
