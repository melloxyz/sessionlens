import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { visibleSessionSql } from '../db/session-filters.js';

function escapeCell(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}

export function registerExportRoutes(app: FastifyInstance): void {
  app.get('/api/export/sessions.csv', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      const db = getDatabase();

      const cli = q.cli || null;
      const provider = q.provider || null;
      const model = q.model || null;
      const projectId = q.projectId ? Number(q.projectId) : null;
      const dateFrom = q.dateFrom || null;
      const dateTo = q.dateTo || null;
      const confidence = q.confidence || null;
      const search = q.search || null;

      let hasFts = false;
      try {
        db.exec(`SELECT 1 FROM messages_fts LIMIT 0`);
        hasFts = true;
      } catch {
        // FTS not available
      }

      let sql = `
        SELECT s.session_id, s.cli, s.model, s.provider,
               COALESCE(s.project_path, '') AS project,
               s.total_cost_usd AS cost_usd,
               s.cost_source,
               COALESCE((SELECT SUM(ue.input_tokens) FROM usage_events ue WHERE ue.session_fk = s.id), 0) AS input_tokens,
               COALESCE((SELECT SUM(ue.output_tokens) FROM usage_events ue WHERE ue.session_fk = s.id), 0) AS output_tokens,
               s.tool_call_count AS tool_calls,
               s.message_count AS messages,
               s.duration_ms,
               s.started_at
        FROM sessions s WHERE ${visibleSessionSql('s')}
      `;
      const params: (string | number | null)[] = [];

      if (cli) {
        sql += ` AND s.cli = ?`;
        params.push(cli);
      }
      if (provider) {
        sql += ` AND s.provider = ?`;
        params.push(provider);
      }
      if (model) {
        sql += ` AND s.model = ?`;
        params.push(model);
      }
      if (projectId) {
        sql += ` AND s.id IN (SELECT s2.id FROM sessions s2 JOIN projects p ON p.path = COALESCE(s2.project_path, 'unknown') WHERE p.id = ?)`;
        params.push(projectId);
      }
      if (dateFrom) {
        sql += ` AND s.started_at >= ?`;
        params.push(dateFrom);
      }
      if (dateTo) {
        sql += ` AND s.started_at <= ?`;
        params.push(dateTo);
      }
      if (confidence) {
        sql += ` AND s.source_confidence = ?`;
        params.push(confidence);
      }
      if (search) {
        if (hasFts) {
          sql += ` AND (s.session_id LIKE ? OR s.project_path LIKE ? OR s.id IN (SELECT DISTINCT session_fk FROM messages_fts WHERE content MATCH ?))`;
          params.push(`%${search}%`, `%${search}%`, `"${search.replace(/"/g, '""')}"`);
        } else {
          sql += ` AND (s.session_id LIKE ? OR s.project_path LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`);
        }
      }
      sql += ` ORDER BY s.started_at DESC`;

      const result = db.exec(sql, params);
      const headers = [
        'session_id',
        'cli',
        'model',
        'provider',
        'project',
        'cost_usd',
        'cost_source',
        'input_tokens',
        'output_tokens',
        'tool_calls',
        'messages',
        'duration_ms',
        'started_at',
      ];
      const rows: unknown[][] = [];
      if (result.length > 0 && result[0].values) {
        for (const row of result[0].values) {
          rows.push(row as unknown[]);
        }
      }

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="sessions.csv"');
      return reply.send(toCsv(headers, rows));
    } catch (error) {
      req.log.error(error, 'Failed to export sessions CSV');
      reply.code(500);
      return {
        error: { code: 'EXPORT_SESSIONS_FAILED', message: 'Failed to export sessions CSV' },
      };
    }
  });

  app.get('/api/export/breakdown.csv', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      const dimension = q.dimension || 'cli';
      const metric = q.metric || 'cost';
      const cli = q.cli || null;
      const provider = q.provider || null;
      const model = q.model || null;
      const project = q.project || null;
      const dateFrom = q.dateFrom || null;
      const dateTo = q.dateTo || null;

      const db = getDatabase();
      const dimMap: Record<string, string> = {
        cli: 'cli',
        provider: 'provider',
        model: 'COALESCE(model, "unknown")',
        project: 'COALESCE(project_path, "unknown")',
      };
      const dim = dimMap[dimension] || 'cli';

      const metricCol =
        metric === 'sessions'
          ? 'COUNT(*)'
          : metric === 'tokens'
            ? 'COALESCE(SUM((SELECT SUM(input_tokens+output_tokens) FROM usage_events WHERE session_fk=sessions.id)), 0)'
            : 'COALESCE(SUM(total_cost_usd), 0)';

      let sql = `SELECT ${dim} AS label, ${metricCol} AS value FROM sessions WHERE ${visibleSessionSql()}`;
      const params: string[] = [];

      if (cli) {
        sql += ` AND cli = ?`;
        params.push(cli);
      }
      if (provider) {
        sql += ` AND LOWER(provider) = LOWER(?)`;
        params.push(provider);
      }
      if (model) {
        sql += ` AND LOWER(COALESCE(model, 'unknown')) = LOWER(?)`;
        params.push(model);
      }
      if (project) {
        sql += ` AND COALESCE(project_path, 'unknown') = ?`;
        params.push(project);
      }
      if (dateFrom) {
        sql += ` AND started_at >= ?`;
        params.push(dateFrom);
      }
      if (dateTo) {
        sql += ` AND started_at <= ?`;
        params.push(dateTo);
      }
      sql += ` GROUP BY ${dim} ORDER BY value DESC`;

      const results = db.exec(sql, params);
      let total = 0;
      const rows: [string, number, number][] = [];

      if (results.length > 0 && results[0].values) {
        for (const r of results[0].values) {
          const val = Number(r[1]) || 0;
          rows.push([(r[0] as string) || 'unknown', val, 0]);
          total += val;
        }
        for (const row of rows) {
          row[2] = total > 0 ? Math.round((row[1] / total) * 10000) / 100 : 0;
        }
      }

      const metricName =
        metric === 'sessions' ? 'sessions' : metric === 'tokens' ? 'tokens' : 'cost_usd';
      const headers = [dimension, metricName, 'percentage'];

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="breakdown.csv"');
      return reply.send(toCsv(headers, rows));
    } catch (error) {
      req.log.error(error, 'Failed to export breakdown CSV');
      reply.code(500);
      return {
        error: { code: 'EXPORT_BREAKDOWN_FAILED', message: 'Failed to export breakdown CSV' },
      };
    }
  });
}
