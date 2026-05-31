import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { platform } from 'node:process';
import { getDatabase } from '../db/connection.js';

const VALID_SESSION_SQL = `NOT (
  session_id = 'unknown'
  AND (project_path IS NULL OR project_path = 'unknown')
  AND (model IS NULL OR model = 'unknown')
  AND COALESCE(message_count, 0) = 0
  AND COALESCE(tool_call_count, 0) = 0
  AND COALESCE(total_cost_usd, 0) = 0
)`;

const VISIBLE_SESSION_SQL = `${VALID_SESSION_SQL}
  AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(project_path, 'unknown'))`;

export function registerSessionRoutes(app: FastifyInstance): void {
  app.get('/api/sessions', async (req, reply) => {
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
      const page = Math.max(1, Number(q.page) || 1);
      const limit = Math.min(500, Math.max(1, Number(q.limit) || 20));
      const sortBy = q.sortBy || 'started_at';
      const sortOrder = q.sortOrder === 'asc' ? 'ASC' : 'DESC';

      const allowedSort = [
        'started_at',
        'total_cost_usd',
        'duration_ms',
        'message_count',
        'tool_call_count',
        'cli',
        'model',
      ];
      const sortCol = allowedSort.includes(sortBy) ? sortBy : 'started_at';

      // Count query
      let countSql = `SELECT COUNT(*) FROM sessions WHERE ${VISIBLE_SESSION_SQL}`;
      const countParams: (string | number | null)[] = [];
      if (cli) {
        countSql += ` AND cli = ?`;
        countParams.push(cli);
      }
      if (provider) {
        countSql += ` AND provider = ?`;
        countParams.push(provider);
      }
      if (model) {
        countSql += ` AND model = ?`;
        countParams.push(model);
      }
      if (projectId) {
        countSql += ` AND id IN (SELECT s2.id FROM sessions s2 JOIN projects p ON p.path = COALESCE(s2.project_path, 'unknown') WHERE p.id = ?)`;
        countParams.push(projectId);
      }
      if (dateFrom) {
        countSql += ` AND started_at >= ?`;
        countParams.push(dateFrom);
      }
      if (dateTo) {
        countSql += ` AND started_at <= ?`;
        countParams.push(dateTo);
      }
      if (confidence) {
        countSql += ` AND source_confidence = ?`;
        countParams.push(confidence);
      }
      if (search) {
        countSql += ` AND (session_id LIKE ? OR project_path LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const countResult = db.exec(countSql, countParams);
      const total = (countResult[0]?.values?.[0]?.[0] as number) ?? 0;

      // Data query
      let dataSql = `
      SELECT id, provider, cli, session_id, project_path, model, started_at, ended_at,
              duration_ms, total_cost_usd, cost_source, source_confidence, message_count, tool_call_count, created_at
      FROM sessions WHERE ${VISIBLE_SESSION_SQL}
    `;
      const dataParams: (string | number | null)[] = [];
      if (cli) {
        dataSql += ` AND cli = ?`;
        dataParams.push(cli);
      }
      if (provider) {
        dataSql += ` AND provider = ?`;
        dataParams.push(provider);
      }
      if (model) {
        dataSql += ` AND model = ?`;
        dataParams.push(model);
      }
      if (projectId) {
        dataSql += ` AND id IN (SELECT s2.id FROM sessions s2 JOIN projects p ON p.path = COALESCE(s2.project_path, 'unknown') WHERE p.id = ?)`;
        dataParams.push(projectId);
      }
      if (dateFrom) {
        dataSql += ` AND started_at >= ?`;
        dataParams.push(dateFrom);
      }
      if (dateTo) {
        dataSql += ` AND started_at <= ?`;
        dataParams.push(dateTo);
      }
      if (confidence) {
        dataSql += ` AND source_confidence = ?`;
        dataParams.push(confidence);
      }
      if (search) {
        dataSql += ` AND (session_id LIKE ? OR project_path LIKE ?)`;
        dataParams.push(`%${search}%`, `%${search}%`);
      }

      dataSql += ` ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
      dataParams.push(limit, (page - 1) * limit);

      const dataResult = db.exec(dataSql, dataParams);
      const data: Record<string, unknown>[] = [];

      if (dataResult.length > 0 && dataResult[0].values) {
        const cols = dataResult[0].columns;
        for (const row of dataResult[0].values) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) {
            obj[cols[i]] = row[i];
          }
          data.push(obj);
        }
      }

      return { data, total, page, limit };
    } catch (error) {
      reply.code(500);
      return {
        error: {
          code: 'SESSIONS_LIST_FAILED',
          message: 'Failed to load sessions',
          details: String(error),
        },
      };
    }
  });

  app.get('/api/sessions/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const db = getDatabase();
      const isNumeric = /^\d+$/.test(id);

      const lookupClause = isNumeric ? 'id = ?' : 'session_id = ?';
      const lookupParam: string | number = isNumeric ? Number(id) : id;

      const sessionResult = db.exec(
        `SELECT * FROM sessions WHERE ${lookupClause} AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(project_path, 'unknown'))`,
        [lookupParam],
      );
      if (
        sessionResult.length === 0 ||
        !sessionResult[0].values ||
        sessionResult[0].values.length === 0
      ) {
        reply.code(404);
        return { error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } };
      }

      const sessionCols = sessionResult[0].columns;
      const sessionRow = sessionResult[0].values[0];
      const session: Record<string, unknown> = {};
      for (let i = 0; i < sessionCols.length; i++) {
        session[sessionCols[i]] = sessionRow[i];
      }
      session.project_exists =
        typeof session.project_path === 'string' && session.project_path !== 'unknown'
          ? existsSync(session.project_path)
          : false;

      const sessionNumericId = session.id as number;

      const msgResult = db.exec(
        `SELECT id, role, content, timestamp FROM messages WHERE session_fk = ? ORDER BY timestamp`,
        [sessionNumericId],
      );
      const messages: Record<string, unknown>[] = [];
      if (msgResult.length > 0 && msgResult[0].values && msgResult[0].columns) {
        const cols = msgResult[0].columns;
        for (const row of msgResult[0].values) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) {
            obj[cols[i]] = row[i];
          }
          messages.push(obj);
        }
      }

      const usageResult = db.exec(
        `SELECT * FROM usage_events WHERE session_fk = ? ORDER BY timestamp`,
        [sessionNumericId],
      );
      const usageEvents: Record<string, unknown>[] = [];
      if (usageResult.length > 0 && usageResult[0].values && usageResult[0].columns) {
        const cols = usageResult[0].columns;
        for (const row of usageResult[0].values) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) {
            obj[cols[i]] = row[i];
          }
          usageEvents.push(obj);
        }
      }

      const modelUsageResult = db.exec(
        `SELECT provider, model, message_count, input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens, tool_calls_count, total_cost_usd
         FROM session_model_usage WHERE session_fk = ? ORDER BY total_cost_usd DESC, message_count DESC`,
        [sessionNumericId],
      );
      const modelUsage: Record<string, unknown>[] = [];
      if (
        modelUsageResult.length > 0 &&
        modelUsageResult[0].values &&
        modelUsageResult[0].columns
      ) {
        const cols = modelUsageResult[0].columns;
        for (const row of modelUsageResult[0].values) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) {
            obj[cols[i]] = row[i];
          }
          modelUsage.push(obj);
        }
      }

      return { ...session, messages, usageEvents, modelUsage };
    } catch (error) {
      reply.code(500);
      return {
        error: {
          code: 'SESSION_DETAIL_FAILED',
          message: 'Failed to load session detail',
          details: String(error),
        },
      };
    }
  });

  app.post('/api/sessions/:id/open-project', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const db = getDatabase();
      const isNumeric = /^\d+$/.test(id);
      const lookupClause = isNumeric ? 'id = ?' : 'session_id = ?';
      const result = db.exec(
        `SELECT project_path FROM sessions WHERE ${lookupClause}`,
        [isNumeric ? Number(id) : id],
      );
      const projectPath = result[0]?.values?.[0]?.[0] as string | undefined;
      if (!projectPath || projectPath === 'unknown' || !existsSync(projectPath)) {
        reply.code(404);
        return { error: { code: 'PROJECT_PATH_NOT_FOUND', message: 'Project folder not found' } };
      }

      const command =
        platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open';
      const child = spawn(command, [projectPath], { detached: true, stdio: 'ignore' });
      child.unref();
      return { ok: true };
    } catch (error) {
      reply.code(500);
      return {
        error: {
          code: 'OPEN_PROJECT_FAILED',
          message: 'Failed to open project folder',
          details: String(error),
        },
      };
    }
  });
}
