import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from './Card.js';
import { Badge } from './Badge.js';
import { Button } from './Button.js';

export function ErrorState({
  title,
  message,
  code,
  details,
  icon: Icon = AlertTriangle,
  onRetry,
}: {
  title: string;
  message: string;
  code?: string;
  details?: string;
  icon?: LucideIcon;
  onRetry?: () => void;
}) {
  return (
    <Card role="alert" className="border-danger/40">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-danger/20 bg-danger-soft text-danger">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              {code && <Badge variant="danger">{code}</Badge>}
            </div>
            <p className="mt-2 text-sm leading-6 text-subtle-foreground">{message}</p>
            {details && (
              <pre className="mt-3 overflow-auto rounded-md border border-border bg-surface-muted p-3 font-mono text-xs leading-5 text-muted-foreground">
                {details}
              </pre>
            )}
          </div>
        </div>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
