import { Link } from 'react-router-dom';
import { FolderOpen, GitBranch } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency } from '../lib/format.js';
import { Card, CardContent } from '../components/ui/Card.js';

interface Project {
  id: number;
  path: string;
  git_remote: string | null;
  total_sessions: number;
  total_cost: number;
}

export function ProjectsPage() {
  const { data, loading } = useApi<{ data: Project[] }>('/api/projects');

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
        <p className="text-sm text-text-tertiary">{data?.data.length ?? 0} projects tracked</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-5">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-bg-elevated mb-3" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-bg-elevated" />
                </CardContent>
              </Card>
            ))
          : data?.data.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <Card className="hover:border-accent-subtle transition-colors cursor-pointer h-full">
                  <CardContent className="space-y-3 py-5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-text-tertiary shrink-0" />
                          <p className="text-sm font-medium text-text-primary truncate">{p.path.split('\\').pop() || p.path}</p>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1 truncate">{p.path}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-tertiary">{p.total_sessions} sessions</span>
                      <span className="text-sm font-semibold text-text-primary">{formatCurrency(p.total_cost)}</span>
                    </div>
                    {p.git_remote && (
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="h-3 w-3 text-text-tertiary" />
                        <span className="text-xs text-text-tertiary truncate">{p.git_remote}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      {!loading && data?.data.length === 0 && (
        <div className="py-16 text-center">
          <FolderOpen className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-tertiary">No projects found. Run an ingestion to populate data.</p>
        </div>
      )}
    </div>
  );
}
