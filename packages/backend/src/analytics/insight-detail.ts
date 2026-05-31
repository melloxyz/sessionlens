import { getDatabase } from '../db/connection.js';
import { buildAnalyticsReport, type AnalyticsFilters } from './engine.js';

export interface InsightDetail {
  id: string;
  kind: string;
  type: 'insight' | 'anomaly';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  value: string;
  sessionId?: string;

  context: {
    trend?: { date: string; spend: number }[];
    current7DaySpend?: number;
    previous7DaySpend?: number;
    growthPercent?: number | null;
    baselineDailySpend?: number;

    projectPath?: string;
    projectSpend?: number;
    projectSessions?: number;
    projectTopModels?: { provider: string; model: string; cost: number }[];

    modelProvider?: string;
    modelName?: string;
    modelSpend?: number;
    modelAvgCost?: number;
    modelAvgMessages?: number;

    cacheMissRate?: number | null;
    topCacheWasteSessions?: { sessionId: string; missRate: number; tokens: number }[];

    spikeDate?: string;
    spikeSpend?: number;

    outlierTokens?: number;
    outlierCost?: number;
    avgTokens?: number;
    avgCost?: number;
    stdTokens?: number;
    stdCost?: number;

    totalSpend?: number;
    totalSessions?: number;
    overallAvgCost?: number;
    overallAvgCacheMiss?: number | null;
  };

  recommendations: {
    title: string;
    description: string;
    url?: string;
    action?: string;
  }[];
}

interface RecDef {
  title: string;
  description: string;
  url?: string;
  action?: string;
}

interface SessionRow {
  id: number;
  session_id: string;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  duration_ms: number | null;
  total_cost_usd: number | null;
  message_count: number;
  tool_call_count: number;
}

interface UsageAggregate {
  session_id: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
}

function validSessionSql(alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `NOT (
    ${prefix}session_id = 'unknown'
    AND (${prefix}project_path IS NULL OR ${prefix}project_path = 'unknown')
    AND (${prefix}model IS NULL OR ${prefix}model = 'unknown')
    AND COALESCE(${prefix}message_count, 0) = 0
    AND COALESCE(${prefix}tool_call_count, 0) = 0
    AND COALESCE(${prefix}total_cost_usd, 0) = 0
  )
  AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(${prefix}project_path, 'unknown'))`;
}

function buildWhere(filters: AnalyticsFilters, alias?: string): { sql: string; params: string[] } {
  const prefix = alias ? `${alias}.` : '';
  let sql = '';
  const params: string[] = [];
  if (filters.dateFrom) {
    sql += ` AND ${prefix}started_at >= ?`;
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ` AND ${prefix}started_at <= ?`;
    params.push(filters.dateTo);
  }
  if (filters.cli) {
    sql += ` AND ${prefix}cli = ?`;
    params.push(filters.cli);
  }
  if (filters.provider) {
    sql += ` AND LOWER(${prefix}provider) = LOWER(?)`;
    params.push(filters.provider);
  }
  if (filters.model) {
    sql += ` AND LOWER(COALESCE(${prefix}model, 'unknown')) = LOWER(?)`;
    params.push(filters.model);
  }
  if (filters.project) {
    sql += ` AND COALESCE(${prefix}project_path, 'unknown') = ?`;
    params.push(filters.project);
  }
  return { sql, params };
}

function mapRows<T>(results: ReturnType<ReturnType<typeof getDatabase>['exec']>): T[] {
  const rows: T[] = [];
  if (results.length === 0 || !results[0].values || !results[0].columns) return rows;
  const columns = results[0].columns;
  for (const row of results[0].values) {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    rows.push(obj as T);
  }
  return rows;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatTokens(value: number | null | undefined): string {
  if (value == null) return '0';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compactPath(value: string | null): string {
  if (!value) return 'unknown';
  const parts = value.split(/[/\\]/).filter(Boolean);
  return parts.slice(-2).join('/');
}

const RECOMMENDATIONS: Record<string, RecDef[]> = {
  growth: [
    {
      title: 'Set a budget limit',
      description: 'Define a spending cap so you are alerted before costs escalate further. A weekly or monthly budget helps catch upward trends early.',
      url: '/budgets',
      action: 'Create budget',
    },
    {
      title: 'Review what caused the growth',
      description: 'Filter recent sessions to see which projects, models or CLIs are driving the increase. Understanding the source is the first step to controlling it.',
      url: '/sessions',
      action: 'Review sessions',
    },
    {
      title: 'Consider cheaper models for light tasks',
      description: 'Not every prompt needs the most expensive model. Switching lighter sessions to a cheaper alternative can cut costs significantly without sacrificing results.',
      url: '/models',
      action: 'Compare models',
    },
  ],
  project: [
    {
      title: 'Set a budget limit for this project',
      description: 'Create a project-scoped budget so you are notified when this workspace approaches or exceeds a comfortable threshold.',
      url: '/budgets',
      action: 'Create budget',
    },
    {
      title: 'Open project detail',
      description: 'See the full breakdown of sessions, models and spend timeline for this project. Understanding usage patterns helps identify optimization opportunities.',
      action: 'Open project',
    },
    {
      title: 'Review sessions in this project',
      description: 'Browse individual sessions to find expensive conversations or sessions that could have used a cheaper model.',
      action: 'Review sessions',
    },
  ],
  model: [
    {
      title: 'Use cheaper models for light tasks',
      description: 'If this expensive model is used for sessions with few messages, consider switching to a cheaper alternative for simple or boilerplate work.',
      url: '/models',
      action: 'Compare models',
    },
    {
      title: 'Set a spending cap for this model',
      description: 'Create a model-scoped budget limit so you get alerted when spend on this specific model crosses a threshold.',
      url: '/budgets',
      action: 'Create budget',
    },
    {
      title: 'Audit sessions using this model',
      description: 'Review which sessions are using this expensive model and whether they genuinely need its capabilities.',
      url: '/sessions',
      action: 'Review sessions',
    },
  ],
  session: [
    {
      title: 'Review this session in detail',
      description: 'Look at the full conversation, messages and tool calls to understand why this session was particularly expensive.',
      action: 'Open session',
    },
    {
      title: 'Set a per-session cost alert',
      description: 'Create a budget limit to catch sessions that exceed a comfortable cost threshold before they grow too large.',
      url: '/budgets',
      action: 'Create budget',
    },
    {
      title: 'Check if a cheaper model would have worked',
      description: 'Review the session to see if a lighter or cheaper model could have handled the same task. Sometimes we default to expensive models out of habit.',
      url: '/models',
      action: 'Compare models',
    },
  ],
  cache: [
    {
      title: 'Improve prompt and system-prompt consistency',
      description: 'High cache miss rates often happen when prompts vary too much between messages. Keeping system prompts stable and reusing prompt patterns helps cache hits.',
      action: 'Review prompts',
    },
    {
      title: 'Reduce context changes between messages',
      description: 'Each large context shift resets the cache. Try to keep conversations focused and avoid mixing unrelated topics in a single session.',
      action: 'Review session',
    },
    {
      title: 'Review the session',
      description: 'Open the full session to see message-by-message where context shifts may have occurred.',
      action: 'Open session',
    },
  ],
  spend: [
    {
      title: 'Check if this was a planned heavy day',
      description: 'A spike can be normal during intensive work. Review what sessions ran that day to decide if the spending was intentional.',
      action: 'Review sessions',
    },
    {
      title: 'Set a daily budget limit',
      description: 'Configure a daily budget to alert you when spend crosses a threshold you are comfortable with.',
      url: '/budgets',
      action: 'Create budget',
    },
    {
      title: 'Review sessions from that date',
      description: 'Filter sessions to the spike date and inspect the most expensive conversations.',
      action: 'Review sessions',
    },
  ],
  token: [
    {
      title: 'Review the session for large context',
      description: 'Sessions with unusually high token counts often have very large input contexts or long back-and-forth conversations. Check if the context size was necessary.',
      action: 'Open session',
    },
    {
      title: 'Use caching or streaming where possible',
      description: 'Some models support prompt caching which reduces token costs for repeated context. Check if your CLI supports cache-friendly modes.',
      action: 'Learn more',
    },
    {
      title: 'Set a token usage alert',
      description: 'Create a budget limit to detect sessions that consume excessive tokens before they become costly.',
      url: '/budgets',
      action: 'Create budget',
    },
  ],
  costOutlier: [
    {
      title: 'Review this session in detail',
      description: 'Open the full session to understand what made it disproportionately expensive compared to your average.',
      action: 'Open session',
    },
    {
      title: 'Set a cost alert threshold',
      description: 'Configure a budget alert so you are notified when any single session exceeds a cost you are comfortable with.',
      url: '/budgets',
      action: 'Create budget',
    },
    {
      title: 'Check model appropriateness',
      description: 'Confirm that the model used was the right choice for the task. Sometimes we use expensive models for work that cheaper alternatives handle well.',
      url: '/models',
      action: 'Compare models',
    },
  ],
  cacheBasin: [
    {
      title: 'Use system prompts more consistently',
      description: 'System-wide cache misses across all sessions suggest prompts are frequently changing. Adopting consistent system prompts can increase cache-hit rates.',
      action: 'Review prompts',
    },
    {
      title: 'Standardize your prompting patterns',
      description: 'Repeating similar instruction patterns allows the model to cache more context, reducing both cost and latency.',
      action: 'Review patterns',
    },
    {
      title: 'Review worst-offender sessions',
      description: 'Identify the sessions with the highest cache miss rates and check what makes their prompts different from your typical sessions.',
      action: 'Review sessions',
    },
  ],
};

function parseInsightId(id: string): {
  kind: string;
  type: 'insight' | 'anomaly';
  entityKey: string;
} {
  if (id === 'spend-growth') {
    return { kind: 'growth', type: 'insight', entityKey: '' };
  }
  if (id === 'cache-basin') {
    return { kind: 'cacheBasin', type: 'anomaly', entityKey: 'basin' };
  }
  if (id.startsWith('project-')) {
    return { kind: 'project', type: 'insight', entityKey: id.slice('project-'.length) };
  }
  if (id.startsWith('model-')) {
    return { kind: 'model', type: 'insight', entityKey: id.slice('model-'.length) };
  }
  if (id.startsWith('session-')) {
    return { kind: 'session', type: 'insight', entityKey: id.slice('session-'.length) };
  }
  if (id.startsWith('cache-')) {
    return { kind: 'cache', type: 'insight', entityKey: id.slice('cache-'.length) };
  }
  if (id.startsWith('spike-')) {
    return { kind: 'spend', type: 'anomaly', entityKey: id.slice('spike-'.length) };
  }
  if (id.startsWith('tokens-')) {
    return { kind: 'token', type: 'anomaly', entityKey: id.slice('tokens-'.length) };
  }
  if (id.startsWith('cost-')) {
    return { kind: 'costOutlier', type: 'anomaly', entityKey: id.slice('cost-'.length) };
  }
  return { kind: '', type: 'insight', entityKey: '' };
}

export function buildInsightDetail(
  id: string,
  filters: AnalyticsFilters = {},
): InsightDetail | null {
  const parsed = parseInsightId(id);
  if (!parsed.kind) return null;

  const report = buildAnalyticsReport(filters);
  const db = getDatabase();

  const summary = report.summary;
  const context: InsightDetail['context'] = {
    totalSpend: summary.totalSpend,
    totalSessions: report.trend.length > 0 ? report.trend.length : 0,
  };

  let title = '';
  let description = '';
  let value = '';
  let sessionId: string | undefined;
  let severity: 'high' | 'medium' | 'low' = 'medium';

  const range = buildWhere(filters);
  const validSession = validSessionSql();
  const usageRange = buildWhere(filters, 's');
  const validSessionS = validSessionSql('s');

  switch (parsed.kind) {
    case 'growth': {
      title = 'Usage is growing faster than last week';
      description = `The last 7 days spent ${report.summary.growthPercent != null ? formatPercent(report.summary.growthPercent) : 'more'} more than the previous 7 days.`;
      value = `${formatCurrency(report.summary.current7DaySpend)} vs ${formatCurrency(report.summary.previous7DaySpend)}`;
      severity = (report.summary.growthPercent ?? 0) >= 50 ? 'high' : 'medium';

      context.trend = queryExtendedTrend(db, filters, 21);
      context.current7DaySpend = report.summary.current7DaySpend;
      context.previous7DaySpend = report.summary.previous7DaySpend;
      context.growthPercent = report.summary.growthPercent;
      context.baselineDailySpend = report.summary.baselineDailySpend;

      const sessionsResult = db.exec(
        `SELECT COUNT(*) AS cnt, COALESCE(AVG(total_cost_usd), 0) AS avgCost FROM sessions WHERE ${validSession}${range.sql}`,
        range.params,
      );
      if (sessionsResult[0]?.values?.[0]) {
        context.totalSessions = Number(sessionsResult[0].values[0][0]) || 0;
        context.overallAvgCost = Number(sessionsResult[0].values[0][1]) || 0;
      }
      break;
    }

    case 'project': {
      const projectSlug = parsed.entityKey;
      const projectResult = db.exec(
        `SELECT COALESCE(project_path, 'unknown'), COALESCE(SUM(total_cost_usd), 0) AS spend, COUNT(*) AS sessions
         FROM sessions WHERE ${validSession}${range.sql}
         GROUP BY COALESCE(project_path, 'unknown')
         HAVING LOWER(REPLACE(REPLACE(COALESCE(project_path, 'unknown'), '/', '-'), '\\', '-')) = LOWER(?)
         ORDER BY spend DESC LIMIT 1`,
        [...range.params, projectSlug],
      );
      const projectRow = projectResult[0]?.values?.[0];
      if (!projectRow) return null;
      const projectPath = String(projectRow[0] ?? 'unknown');
      const projectSpend = Number(projectRow[1]) || 0;
      const projectSessions = Number(projectRow[2]) || 0;

      const topModelsResult = db.exec(
        `SELECT COALESCE(provider, 'unknown') AS provider, COALESCE(model, 'unknown') AS model, COALESCE(SUM(total_cost_usd), 0) AS cost
         FROM sessions WHERE ${validSession} AND COALESCE(project_path, 'unknown') = ?${range.sql}
         GROUP BY COALESCE(provider, 'unknown'), COALESCE(model, 'unknown')
         ORDER BY cost DESC LIMIT 5`,
        [projectPath, ...range.params],
      );

      title = 'One project dominates spend';
      description = `${compactPath(projectPath)} is the highest-cost project and takes ${formatPercent(summary.totalSpend > 0 ? (projectSpend / summary.totalSpend) * 100 : 0)} of total spend.`;
      value = `${formatCurrency(projectSpend)} · ${projectSessions} sessions`;
      severity = projectSpend / Math.max(summary.totalSpend, 0.01) >= 0.5 ? 'high' : 'medium';

      context.projectPath = projectPath;
      context.projectSpend = projectSpend;
      context.projectSessions = projectSessions;
      context.projectTopModels = mapRows<{ provider: string; model: string; cost: number }>(
        topModelsResult,
      );
      break;
    }

    case 'model': {
      const modelSlug = parsed.entityKey;
      const modelResult = db.exec(
        `SELECT COALESCE(provider, 'unknown') AS provider, COALESCE(model, 'unknown') AS model,
                COALESCE(SUM(total_cost_usd), 0) AS spend,
                COALESCE(AVG(total_cost_usd), 0) AS avgCost,
                COALESCE(AVG(message_count), 0) AS avgMessages
         FROM sessions WHERE ${validSession}${range.sql}
         GROUP BY COALESCE(provider, 'unknown'), COALESCE(model, 'unknown')
         HAVING LOWER(REPLACE(REPLACE(COALESCE(provider, 'unknown') || '-' || COALESCE(model, 'unknown'), '/', '-'), '\\', '-')) = LOWER(?)
         ORDER BY spend DESC LIMIT 1`,
        [...range.params, modelSlug],
      );
      const modelRow = modelResult[0]?.values?.[0];
      if (!modelRow) return null;
      const provider = String(modelRow[0] ?? 'unknown');
      const modelName = String(modelRow[1] ?? 'unknown');
      const modelSpend = Number(modelRow[2]) || 0;
      const modelAvgCost = Number(modelRow[3]) || 0;
      const modelAvgMessages = Number(modelRow[4]) || 0;

      title = 'Expensive model used for lighter sessions';
      description = `${provider}/${modelName} averages ${formatTokens(modelAvgMessages)} messages per session while staying well above the overall average cost.`;
      value = `${formatCurrency(modelAvgCost)} avg/session`;
      severity = 'medium';

      context.modelProvider = provider;
      context.modelName = modelName;
      context.modelSpend = modelSpend;
      context.modelAvgCost = modelAvgCost;
      context.modelAvgMessages = modelAvgMessages;

      const allSessionsResult = db.exec(
        `SELECT COALESCE(AVG(total_cost_usd), 0) AS avgCost FROM sessions WHERE ${validSession}${range.sql}`,
        range.params,
      );
      if (allSessionsResult[0]?.values?.[0]) {
        context.overallAvgCost = Number(allSessionsResult[0].values[0][0]) || 0;
      }
      break;
    }

    case 'session': {
      const sessionDbId = parseInt(parsed.entityKey, 10);
      if (Number.isNaN(sessionDbId)) return null;

      const sessionResult = db.exec(
        `SELECT id, session_id, cli, provider, model, project_path, started_at, duration_ms, total_cost_usd, message_count, tool_call_count
         FROM sessions WHERE ${validSession} AND id = ?${range.sql}`,
        [sessionDbId, ...range.params],
      );
      const sessionRow = mapRows<SessionRow>(sessionResult)[0];
      if (!sessionRow) return null;

      title = 'Long expensive session detected';
      description = `Session ${sessionRow.session_id.slice(0, 10)} is among the priciest entries and may deserve a closer look.`;
      value = `${formatCurrency(sessionRow.total_cost_usd)} · ${sessionRow.duration_ms != null ? `${Math.round(sessionRow.duration_ms / 60000)}m` : '—'}`;
      severity = 'medium';
      sessionId = sessionRow.session_id;

      const allSessionsResult = db.exec(
        `SELECT COALESCE(AVG(total_cost_usd), 0) AS avgCost, COUNT(*) AS cnt FROM sessions WHERE ${validSession}${range.sql}`,
        range.params,
      );
      if (allSessionsResult[0]?.values?.[0]) {
        context.overallAvgCost = Number(allSessionsResult[0].values[0][0]) || 0;
        context.totalSessions = Number(allSessionsResult[0].values[0][1]) || 0;
      }
      context.outlierCost = sessionRow.total_cost_usd ?? 0;
      break;
    }

    case 'cache': {
      const cacheSessionDbId = parseInt(parsed.entityKey, 10);
      if (Number.isNaN(cacheSessionDbId)) return null;

      const usageResult = db.exec(
        `SELECT
           s.id, s.session_id, s.cli, s.provider, s.model, s.project_path,
           s.started_at, s.duration_ms, s.total_cost_usd, s.message_count, s.tool_call_count,
           COALESCE(SUM(ue.input_tokens), 0) AS input_tokens,
           COALESCE(SUM(ue.output_tokens), 0) AS output_tokens,
           COALESCE(SUM(ue.cache_read_tokens), 0) AS cache_read_tokens,
           COALESCE(SUM(ue.cache_write_tokens), 0) AS cache_write_tokens,
           COALESCE(SUM(ue.reasoning_tokens), 0) AS reasoning_tokens
         FROM sessions s
         LEFT JOIN usage_events ue ON ue.session_fk = s.id
         WHERE ${validSessionS} AND s.id = ?${usageRange.sql}
         GROUP BY s.id`,
        [cacheSessionDbId, ...usageRange.params],
      );
      const cacheRow = mapRows<any>(usageResult)[0];
      if (!cacheRow) return null;

      const inputTokens =
        (Number(cacheRow.input_tokens) || 0) +
        (Number(cacheRow.cache_read_tokens) || 0) +
        (Number(cacheRow.cache_write_tokens) || 0);
      const cacheHitRate = inputTokens > 0 ? (Number(cacheRow.cache_read_tokens) || 0) / inputTokens : null;
      const cacheMissRate = cacheHitRate != null ? 1 - cacheHitRate : null;

      title = 'High context waste on a session';
      description = `${cacheRow.cli} on ${compactPath(cacheRow.project_path)} is missing cache hits for most of its input tokens.`;
      value = `${cacheMissRate != null ? formatPercent(cacheMissRate * 100) : '—'} miss rate`;
      severity = (cacheMissRate ?? 0) >= 0.75 ? 'high' : 'medium';
      sessionId = cacheRow.session_id;

      context.cacheMissRate = cacheMissRate;

      const topWasteResult = db.exec(
        `SELECT
           s.session_id,
           CASE WHEN (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0)) > 0
             THEN ROUND((1.0 - COALESCE(SUM(ue.cache_read_tokens), 0) * 1.0 / (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0))) * 100, 1)
             ELSE NULL
           END AS miss_rate,
           COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.output_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0) + COALESCE(SUM(ue.reasoning_tokens), 0) AS total_tokens
         FROM sessions s
         LEFT JOIN usage_events ue ON ue.session_fk = s.id
         WHERE ${validSessionS}${usageRange.sql}
         GROUP BY s.id
         HAVING total_tokens >= 1000 AND miss_rate IS NOT NULL
         ORDER BY miss_rate DESC LIMIT 5`,
        usageRange.params,
      );
      context.topCacheWasteSessions =
        mapRows<{ sessionId: string; missRate: number; tokens: number }>(topWasteResult).map(
          (r) => ({
            sessionId: r.sessionId,
            missRate: Number(r.missRate) || 0,
            tokens: Number(r.tokens) || 0,
          }),
        );

      const avgCacheResult = db.exec(
        `SELECT
           AVG(CASE WHEN (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0)) > 0
             THEN 1.0 - COALESCE(SUM(ue.cache_read_tokens), 0) * 1.0 / (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0))
             ELSE NULL END)
         FROM sessions s
         LEFT JOIN usage_events ue ON ue.session_fk = s.id
         WHERE ${validSessionS}${usageRange.sql}`,
        usageRange.params,
      );
      if (avgCacheResult[0]?.values?.[0]?.[0] != null) {
        context.overallAvgCacheMiss = Number(avgCacheResult[0].values[0][0]) || null;
      }
      break;
    }

    case 'spend': {
      const spikeDate = parsed.entityKey;
      const trend = report.trend;
      const spikePoint = trend.find((p) => p.date === spikeDate);

      title = 'Daily spend spike';
      const baseline = report.summary.baselineDailySpend;
      const spikeSpend = spikePoint?.spend ?? 0;
      description = `The latest day spent ${formatPercent(baseline > 0 ? ((spikeSpend / baseline) * 100 - 100) : 0)} more than the 7-day baseline.`;
      value = `${formatCurrency(spikeSpend)} vs ${formatCurrency(baseline)}/day`;
      severity = spikeSpend >= baseline * 3 ? 'high' : 'medium';

      context.trend = trend;
      context.spikeDate = spikeDate;
      context.spikeSpend = spikeSpend;
      context.baselineDailySpend = baseline;
      context.current7DaySpend = report.summary.current7DaySpend;
      break;
    }

    case 'token': {
      const tokenSessionDbId = parseInt(parsed.entityKey, 10);
      if (Number.isNaN(tokenSessionDbId)) return null;

      const tokenSessionResult = db.exec(
        `SELECT s.id, s.session_id, s.cli, s.provider, s.model, s.project_path, s.started_at, s.duration_ms, s.total_cost_usd
         FROM sessions s WHERE ${validSessionS} AND s.id = ?${usageRange.sql}`,
        [tokenSessionDbId, ...usageRange.params],
      );
      const tokenSession = mapRows<SessionRow>(tokenSessionResult)[0];
      if (!tokenSession) return null;

      const tokenUsageResult = db.exec(
        `SELECT
           COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0) + COALESCE(SUM(cache_read_tokens), 0) + COALESCE(SUM(cache_write_tokens), 0) + COALESCE(SUM(reasoning_tokens), 0) AS total
         FROM usage_events WHERE session_fk = ?`,
        [tokenSessionDbId],
      );
      const outlierTokens = Number(tokenUsageResult[0]?.values?.[0]?.[0] ?? 0);

      const allTokensResult = db.exec(
        `SELECT
           COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.output_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0) + COALESCE(SUM(ue.reasoning_tokens), 0) AS total
         FROM sessions s
         LEFT JOIN usage_events ue ON ue.session_fk = s.id
         WHERE ${validSessionS}${usageRange.sql}
         GROUP BY s.id`,
        usageRange.params,
      );
      const allTokenValues = (allTokensResult[0]?.values ?? []).map((r) => Number(r[0]) || 0);
      const avgT = average(allTokenValues);
      const stdT = standardDeviation(allTokenValues);

      title = 'Token usage outlier';
      description = `Session ${tokenSession.session_id.slice(0, 10)} used far more tokens than the typical session.`;
      value = formatTokens(outlierTokens);
      severity = 'medium';
      sessionId = tokenSession.session_id;

      context.outlierTokens = outlierTokens;
      context.avgTokens = avgT;
      context.stdTokens = stdT;
      context.totalSessions = allTokenValues.length;
      break;
    }

    case 'costOutlier': {
      const costSessionDbId = parseInt(parsed.entityKey, 10);
      if (Number.isNaN(costSessionDbId)) return null;

      const costSessionResult = db.exec(
        `SELECT id, session_id, cli, provider, model, project_path, started_at, duration_ms, total_cost_usd, message_count, tool_call_count
         FROM sessions WHERE ${validSession} AND id = ?${range.sql}`,
        [costSessionDbId, ...range.params],
      );
      const costSession = mapRows<SessionRow>(costSessionResult)[0];
      if (!costSession) return null;

      const allCostsResult = db.exec(
        `SELECT COALESCE(total_cost_usd, 0) AS cost FROM sessions WHERE ${validSession}${range.sql}`,
        range.params,
      );
      const allCosts = (allCostsResult[0]?.values ?? []).map((r) => Number(r[0]) || 0);
      const avgC = average(allCosts);
      const stdC = standardDeviation(allCosts);

      title = 'High-cost session outlier';
      description = `Session ${costSession.session_id.slice(0, 10)} is much more expensive than the average session.`;
      value = formatCurrency(costSession.total_cost_usd);
      severity = 'medium';
      sessionId = costSession.session_id;

      context.outlierCost = costSession.total_cost_usd ?? 0;
      context.avgCost = avgC;
      context.stdCost = stdC;
      context.totalSessions = allCosts.length;
      break;
    }

    case 'cacheBasin': {
      const avgCacheBasinResult = db.exec(
        `SELECT
           AVG(CASE WHEN (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0)) > 0
             THEN 1.0 - COALESCE(SUM(ue.cache_read_tokens), 0) * 1.0 / (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0))
             ELSE NULL END)
         FROM sessions s
         LEFT JOIN usage_events ue ON ue.session_fk = s.id
         WHERE ${validSessionS}${usageRange.sql}`,
        usageRange.params,
      );
      const avgCM = avgCacheBasinResult[0]?.values?.[0]?.[0] != null
        ? Number(avgCacheBasinResult[0].values[0][0])
        : null;

      const topWasteBasinResult = db.exec(
        `SELECT
           s.session_id,
           CASE WHEN (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0)) > 0
             THEN ROUND((1.0 - COALESCE(SUM(ue.cache_read_tokens), 0) * 1.0 / (COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0))) * 100, 1)
             ELSE NULL
           END AS miss_rate,
           COALESCE(SUM(ue.input_tokens), 0) + COALESCE(SUM(ue.output_tokens), 0) + COALESCE(SUM(ue.cache_read_tokens), 0) + COALESCE(SUM(ue.cache_write_tokens), 0) + COALESCE(SUM(ue.reasoning_tokens), 0) AS total_tokens
         FROM sessions s
         LEFT JOIN usage_events ue ON ue.session_fk = s.id
         WHERE ${validSessionS}${usageRange.sql}
         GROUP BY s.id
         HAVING total_tokens >= 1000 AND miss_rate IS NOT NULL
         ORDER BY miss_rate DESC LIMIT 5`,
        usageRange.params,
      );

      title = 'High cache miss rate overall';
      description = 'Across analyzed sessions, cache misses remain elevated.';
      value = `${avgCM != null ? formatPercent(avgCM * 100) : '—'} average miss rate`;
      severity = (avgCM ?? 0) >= 0.7 ? 'high' : 'medium';

      context.overallAvgCacheMiss = avgCM;
      context.topCacheWasteSessions =
        mapRows<{ sessionId: string; missRate: number; tokens: number }>(
          topWasteBasinResult,
        ).map((r) => ({
          sessionId: r.sessionId,
          missRate: Number(r.missRate) || 0,
          tokens: Number(r.tokens) || 0,
        }));
      break;
    }

    default:
      return null;
  }

  const recs = RECOMMENDATIONS[parsed.kind] ?? [];

  return {
    id,
    kind: parsed.kind,
    type: parsed.type,
    severity,
    title,
    description,
    value,
    sessionId,
    context,
    recommendations: recs,
  };
}

function queryExtendedTrend(
  db: ReturnType<typeof getDatabase>,
  filters: AnalyticsFilters,
  days: number,
): { date: string; spend: number }[] {
  const range = buildWhere(filters);
  const validSession = validSessionSql();
  const anchorResult = db.exec(
    `SELECT date(MAX(started_at)) AS anchor FROM sessions WHERE ${validSession}${range.sql}`,
    range.params,
  );
  const anchor = anchorResult[0]?.values?.[0]?.[0] as string | undefined;
  if (!anchor) return [];

  const anchorDate = new Date(anchor + 'T00:00:00.000Z');
  anchorDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(anchorDate);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  const filterWhere = buildWhere({ ...filters, dateFrom: null, dateTo: null });
  const params: string[] = [startDate.toISOString().slice(0, 10), ...filterWhere.params];
  let dateToSql = '';
  if (filters.dateTo) {
    dateToSql = ' AND started_at <= ?';
    params.push(filters.dateTo);
  }

  const spendResult = db.exec(
    `SELECT date(started_at) AS day, COALESCE(SUM(total_cost_usd), 0) AS spend
     FROM sessions
     WHERE ${validSession} AND started_at >= ?${filterWhere.sql}${dateToSql}
     GROUP BY day`,
    params,
  );

  const spendByDay = new Map<string, number>();
  for (const row of mapRows(spendResult) as { day: string; spend: number }[]) {
    spendByDay.set(row.day, Number(row.spend) || 0);
  }

  const points: { date: string; spend: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(startDate);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    points.push({ date: key, spend: spendByDay.get(key) ?? 0 });
  }

  return points;
}
