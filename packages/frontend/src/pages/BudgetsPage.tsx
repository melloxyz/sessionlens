import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { getBrandMeta } from '../components/brand/BrandMark.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { AlertStrip } from '../components/ui/AlertStrip.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { ControlField } from '../components/ui/ControlField.js';
import { DataPanel } from '../components/ui/DataPanel.js';
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
import { MetricBlock } from '../components/ui/MetricBlock.js';
import { Sensitive } from '../components/ui/Sensitive.js';
import { Select } from '../components/ui/Select.js';
import { useApi } from '../hooks/useApi.js';
import { compactPath, formatCurrency, formatDateTime } from '../lib/format.js';

interface BudgetLimit {
  id: number;
  scope_type: 'global' | 'project' | 'cli' | 'model' | 'provider';
  scope_value: string | null;
  limit_usd: number;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  enabled: number;
}

interface BudgetStatus {
  id: number;
  scope_type: string;
  scope_value: string | null;
  limit_usd: number;
  period: string;
  current_spend: number;
  percentage: number;
  status: 'ok' | 'warning' | 'approaching' | 'exceeded';
}

interface AlertRow {
  id: number;
  type: string;
  title: string;
  message: string;
  current_spend: number;
  limit_usd: number;
  acknowledged: number;
  created_at: string;
}

interface FilterOption {
  label: string;
  value: string;
  count: number;
}

interface FilterOptionsResponse {
  clis: FilterOption[];
  providers: FilterOption[];
  models: FilterOption[];
  projects: FilterOption[];
}

type BudgetScope = BudgetLimit['scope_type'];

export function BudgetsPage() {
  const { t } = useI18n();
  const {
    data: budgets,
    loading: _budgetsLoading,
    error: budgetsError,
    refetch: refetchBudgets,
  } = useApi<BudgetLimit[]>('/api/budgets', { initialData: [] });

  const {
    data: status,
    loading: _statusLoading,
    refetch: refetchStatus,
  } = useApi<BudgetStatus[]>('/api/budgets/status', { initialData: [] });

  const {
    data: alertsData,
    loading: _alertsLoading,
    refetch: refetchAlerts,
  } = useApi<{ alerts: AlertRow[]; total: number }>('/api/alerts', {
    initialData: { alerts: [], total: 0 },
  });

  const { data: filterOptions } = useApi<FilterOptionsResponse>('/api/analytics/filter-options', {
    initialData: { clis: [], providers: [], models: [], projects: [] },
  });

  const [showForm, setShowForm] = useState(false);
  const [formScope, setFormScope] = useState<BudgetScope>('global');
  const [formScopeValue, setFormScopeValue] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [formPeriod, setFormPeriod] = useState<BudgetLimit['period']>('monthly');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const unacknowledgedAlerts = (alertsData?.alerts ?? []).filter((a) => !a.acknowledged);

  const summary = useMemo(
    () => ({
      activeBudgets: (budgets ?? []).filter((budget) => budget.enabled).length,
      exceeded: (status ?? []).filter((item) => item.status === 'exceeded').length,
      approaching: (status ?? []).filter((item) => item.status === 'approaching').length,
      monitoredSpend: (status ?? []).reduce(
        (sum, item) => sum + Number(item.current_spend || 0),
        0,
      ),
    }),
    [budgets, status],
  );

  const scopedOptions = useMemo(() => {
    if (formScope === 'project') {
      return (filterOptions?.projects ?? []).map((item) => ({
        label: `${compactPath(item.label)} (${item.count})`,
        value: item.value,
      }));
    }
    if (formScope === 'cli') {
      return (filterOptions?.clis ?? []).map((item) => ({
        label: `${getBrandMeta(item.value, 'cli').label} (${item.count})`,
        value: item.value,
      }));
    }
    if (formScope === 'provider') {
      return (filterOptions?.providers ?? []).map((item) => ({
        label: `${item.label} (${item.count})`,
        value: item.value,
      }));
    }
    if (formScope === 'model') {
      return (filterOptions?.models ?? []).map((item) => ({
        label: `${item.label} (${item.count})`,
        value: item.value,
      }));
    }
    return [];
  }, [filterOptions, formScope]);

  async function handleCreate() {
    const limitUsd = parseFloat(formLimit);
    if (Number.isNaN(limitUsd) || limitUsd <= 0) {
      setFormError(t('budget.form.invalid'));
      return;
    }

    if (formScope !== 'global' && !formScopeValue.trim()) {
      setFormError(t('budget.form.scopeRequired'));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_type: formScope,
          scope_value: formScope === 'global' ? null : formScopeValue || null,
          limit_usd: limitUsd,
          period: formPeriod,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      resetForm();
      await Promise.all([refetchBudgets(), refetchStatus()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
    await Promise.all([refetchBudgets(), refetchStatus()]);
  }

  function resetForm() {
    setShowForm(false);
    setFormScope('global');
    setFormScopeValue('');
    setFormLimit('');
    setFormPeriod('monthly');
    setFormError(null);
  }

  if (budgetsError) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState
          title={t('budget.failed')}
          message={budgetsError.message}
          code={budgetsError.code}
          details={budgetsError.details}
          onRetry={refetchBudgets}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-5 p-4 lg:p-6">
      <FigurePanel
        figure="BUDGET COMMAND"
        title={t('budget.title')}
        description={t('budget.description')}
        contentClassName="space-y-4 p-4"
        action={
          <Button onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="h-4 w-4" />
            {t('budget.add')}
          </Button>
        }
      >
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] 2xl:items-start">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">{t('budget.title')}</div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {t('budget.description')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
            <MetricBlock
              variant="compact"
              label={t('budget.summary.active')}
              value={String(summary.activeBudgets)}
            />
            <MetricBlock
              variant="compact"
              label={t('budget.summary.approaching')}
              value={String(summary.approaching)}
              tone="warning"
            />
            <MetricBlock
              variant="compact"
              label={t('budget.summary.alerts')}
              value={String(unacknowledgedAlerts.length)}
              tone="warning"
            />
            <MetricBlock
              variant="compact"
              label={t('budget.summary.monitoredSpend')}
              value={<Sensitive>{formatCurrency(summary.monitoredSpend)}</Sensitive>}
              tone="success"
            />
          </div>
        </div>
      </FigurePanel>

      {summary.exceeded > 0 && (
        <AlertStrip
          tone="danger"
          icon={ShieldAlert}
          title={t('budget.status.exceeded')}
          description={`${summary.exceeded} ${t('budget.summary.exceeded').toLowerCase()}`}
          badge={summary.exceeded}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <section className="space-y-5">
          {showForm && (
            <FigurePanel
              figure="BUILDER"
              title={t('budget.form.title')}
              contentClassName="space-y-4 p-4"
            >
              {formError && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  {formError}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                <ControlField label={t('budget.scope')}>
                  <Select
                    value={formScope}
                    onChange={(event) => {
                      setFormScope(event.target.value as BudgetScope);
                      setFormScopeValue('');
                    }}
                    options={[
                      { label: t('budget.scope.global'), value: 'global' },
                      { label: t('budget.scope.project'), value: 'project' },
                      { label: t('budget.scope.cli'), value: 'cli' },
                      { label: t('budget.scope.model'), value: 'model' },
                      { label: t('budget.scope.provider'), value: 'provider' },
                    ]}
                  />
                </ControlField>
                <ControlField label={t('budget.period')}>
                  <Select
                    value={formPeriod}
                    onChange={(event) => setFormPeriod(event.target.value as BudgetLimit['period'])}
                    options={[
                      { label: t('budget.period.daily'), value: 'daily' },
                      { label: t('budget.period.weekly'), value: 'weekly' },
                      { label: t('budget.period.monthly'), value: 'monthly' },
                      { label: t('budget.period.all_time'), value: 'all_time' },
                    ]}
                  />
                </ControlField>
              </div>

              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_220px]">
                {formScope !== 'global' && (
                  <ControlField label={t(`budget.form.scopeValue.${formScope}`)}>
                    {scopedOptions.length > 0 ? (
                      <Select
                        value={formScopeValue}
                        onChange={(event) => setFormScopeValue(event.target.value)}
                        options={[
                          { label: t('budget.form.selectValue'), value: '' },
                          ...scopedOptions,
                        ]}
                      />
                    ) : (
                      <Input
                        value={formScopeValue}
                        onChange={(event) => setFormScopeValue(event.target.value)}
                        placeholder={t(`budget.form.placeholder.${formScope}`)}
                      />
                    )}
                  </ControlField>
                )}

                <ControlField label={t('budget.form.limit')}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formLimit}
                    onChange={(event) => setFormLimit(event.target.value)}
                    placeholder="50.00"
                  />
                </ControlField>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? t('common.loading') : t('budget.form.create')}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4" />
                  {t('common.cancel')}
                </Button>
              </div>
            </FigurePanel>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <FigurePanel
              figure="LIMITS"
              title={t('budget.table.title')}
              description={t('budget.table.description')}
              contentClassName="p-0"
            >
              {(budgets ?? []).length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title={t('budget.empty.title')}
                    description={t('budget.empty.description')}
                    icon={WalletCards}
                  />
                </div>
              ) : (
                <DataTableContainer>
                  <DataTable>
                    <DataTableHead>
                      <DataTableHeaderCell>{t('budget.scope')}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t('common.value')}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t('budget.limit')}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t('budget.period')}</DataTableHeaderCell>
                      <DataTableHeaderCell />
                    </DataTableHead>
                    <DataTableBody>
                      {(budgets ?? []).map((budget) => (
                        <DataTableRow key={budget.id}>
                          <DataTableCell>
                            <Badge variant="neutral">
                              {t(`budget.scope.${budget.scope_type}`)}
                            </Badge>
                          </DataTableCell>
                          <DataTableCell className="font-mono text-sm text-foreground">
                            {renderScopeValue(budget.scope_type, budget.scope_value)}
                          </DataTableCell>
                          <DataTableCell className="text-sm font-semibold text-foreground">
                            <Sensitive>{formatCurrency(budget.limit_usd)}</Sensitive>
                          </DataTableCell>
                          <DataTableCell className="text-sm text-muted-foreground">
                            {t(`budget.period.${budget.period}`)}
                          </DataTableCell>
                          <DataTableCell>
                            <button
                              type="button"
                              onClick={() => handleDelete(budget.id)}
                              className="rounded p-1 text-subtle-foreground transition-colors hover:text-danger"
                              aria-label={t('budget.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTableContainer>
              )}
            </FigurePanel>

            <FigurePanel
              figure="STATUS"
              title={t('budget.status.title')}
              description={t('budget.status.description')}
              contentClassName="p-0"
            >
              {(status ?? []).length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title={t('budget.status.empty.title')}
                    description={t('budget.status.empty.description')}
                    icon={WalletCards}
                  />
                </div>
              ) : (
                <DataTableContainer>
                  <DataTable>
                    <DataTableHead>
                      <DataTableHeaderCell>{t('budget.scope')}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t('budget.status.progress')}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t('budget.period')}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t('budget.status.label')}</DataTableHeaderCell>
                    </DataTableHead>
                    <DataTableBody>
                      {(status ?? []).map((item) => (
                        <DataTableRow key={`${item.id}-${item.scope_type}-${item.scope_value}`}>
                          <DataTableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-foreground">
                                {t(`budget.scope.${item.scope_type}`)}
                              </span>
                              {item.scope_value ? (
                                <span className="font-mono text-xs text-subtle-foreground">
                                  {item.scope_type === 'project'
                                    ? compactPath(item.scope_value)
                                    : item.scope_value}
                                </span>
                              ) : null}
                            </div>
                          </DataTableCell>
                          <DataTableCell>
                            <div className="flex flex-col gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                <Sensitive>{formatCurrency(item.current_spend)}</Sensitive> /{' '}
                                <Sensitive>{formatCurrency(item.limit_usd)}</Sensitive>
                              </span>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                                <div
                                  className={statusBarClass(item.status)}
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </DataTableCell>
                          <DataTableCell className="text-sm text-muted-foreground">
                            {t(`budget.period.${item.period}`)}
                          </DataTableCell>
                          <DataTableCell>
                            <Badge variant={statusVariant(item.status)}>
                              {item.status === 'ok'
                                ? t('budget.status.ok')
                                : item.status === 'exceeded'
                                  ? t('budget.status.exceeded')
                                  : `${item.percentage}%`}
                            </Badge>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTableContainer>
              )}
            </FigurePanel>
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <FigurePanel
            figure="ALERTS"
            title={t('budget.alerts.title')}
            description={t('budget.alerts.description')}
            action={
              unacknowledgedAlerts.length > 0 ? (
                <Badge variant="danger">{unacknowledgedAlerts.length}</Badge>
              ) : (
                <Badge variant="success">{alertsData?.alerts.length ?? 0}</Badge>
              )
            }
            contentClassName="space-y-3 p-3"
          >
            {alertsData && alertsData.total === 0 ? (
              <EmptyState
                title={t('budget.alerts.empty.title')}
                description={t('budget.alerts.empty.description')}
                icon={CheckCircle2}
              />
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-y-auto">
                {(alertsData?.alerts ?? []).slice(0, 20).map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 text-sm ${
                      alert.acknowledged
                        ? 'border-border bg-surface-muted'
                        : alert.type === 'exceeded'
                          ? 'border-danger/30 bg-danger/5'
                          : 'border-warning/30 bg-warning/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {alert.type === 'exceeded' ? (
                            <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          )}
                          <span className="font-medium text-foreground">{alert.title}</span>
                          <Badge variant={alert.acknowledged ? 'neutral' : 'warning'}>
                            {alert.acknowledged ? t('budget.alerts.seen') : t('budget.alerts.new')}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">
                          {alert.message}
                        </div>
                        <div className="mt-2 font-mono text-[10px] text-subtle-foreground">
                          {formatDateTime(alert.created_at)}
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/alerts/${alert.id}/acknowledge`, { method: 'POST' });
                            await refetchAlerts();
                          }}
                          className="rounded p-1 text-subtle-foreground transition-colors hover:text-accent"
                          aria-label={t('budget.alerts.acknowledge')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FigurePanel>

          <DataPanel
            title={t('budget.summary.title')}
            contentClassName="grid gap-3 p-3 text-sm sm:grid-cols-2 xl:grid-cols-1"
          >
            <SummaryRow label={t('budget.summary.active')} value={String(summary.activeBudgets)} />
            <SummaryRow
              label={t('budget.summary.exceeded')}
              value={String(summary.exceeded)}
              tone="danger"
            />
            <SummaryRow
              label={t('budget.summary.approaching')}
              value={String(summary.approaching)}
              tone="warning"
            />
            <SummaryRow
              label={t('budget.summary.alerts')}
              value={String(unacknowledgedAlerts.length)}
              tone="warning"
            />
          </DataPanel>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono font-medium ${
          tone === 'danger'
            ? 'text-danger'
            : tone === 'warning'
              ? 'text-warning'
              : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function renderScopeValue(scope: BudgetScope, value: string | null) {
  if (!value) return <span className="text-subtle-foreground">—</span>;
  if (scope === 'project') {
    return (
      <Link to="/projects" className="text-accent hover:underline">
        {compactPath(value)}
      </Link>
    );
  }
  return value;
}

function statusVariant(status: BudgetStatus['status']) {
  if (status === 'exceeded') return 'danger';
  if (status === 'approaching' || status === 'warning') return 'warning';
  return 'success';
}

function statusBarClass(status: BudgetStatus['status']) {
  if (status === 'exceeded') return 'h-full rounded-full bg-danger transition-all';
  if (status === 'approaching') return 'h-full rounded-full bg-warning transition-all';
  if (status === 'warning') return 'h-full rounded-full bg-amber-400 transition-all';
  return 'h-full rounded-full bg-accent transition-all';
}
