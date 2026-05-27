import type { FastifyInstance } from 'fastify';
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

export function registerOverviewRoutes(app: FastifyInstance): void {
  app.get('/api/overview', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      const dateFrom = q.dateFrom || null;
      const dateTo = q.dateTo || null;
      const db = getDatabase();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStr = todayStart.toISOString();

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStr = weekStart.toISOString();

      const monthStart = new Date();
      monthStart.setDate(monthStart.getDate() - 30);
      const monthStr = monthStart.toISOString();

      let rangeClause = '';
      const rangeParams: string[] = [];
      if (dateFrom) { rangeClause += ' AND started_at >= ?'; rangeParams.push(dateFrom); }
      if (dateTo) { rangeClause += ' AND started_at <= ?'; rangeParams.push(dateTo); }
      const params = [
        todayStr, ...rangeParams,
        weekStr, ...rangeParams,
        monthStr, ...rangeParams,
        ...rangeParams,
        ...rangeParams,
        ...rangeParams,
        ...rangeParams,
      ];

      const results = db.exec(`
        SELECT
          (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE ${VISIBLE_SESSION_SQL} AND started_at >= ?${rangeClause}) AS today_spend,
          (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE ${VISIBLE_SESSION_SQL} AND started_at >= ?${rangeClause}) AS weekly_spend,
          (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE ${VISIBLE_SESSION_SQL} AND started_at >= ?${rangeClause}) AS monthly_spend,
          (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE ${VISIBLE_SESSION_SQL}${rangeClause}) AS total_spend,
          (SELECT COUNT(*) FROM sessions WHERE ${VISIBLE_SESSION_SQL}${rangeClause}) AS session_count,
          (SELECT COALESCE(AVG(total_cost_usd), 0) FROM sessions WHERE ${VISIBLE_SESSION_SQL} AND total_cost_usd IS NOT NULL${rangeClause}) AS avg_cost,
          (SELECT cli FROM sessions WHERE ${VISIBLE_SESSION_SQL}${rangeClause} GROUP BY cli ORDER BY COUNT(*) DESC LIMIT 1) AS most_used_cli
      `, params);

      if (results.length === 0 || !results[0].values) {
        return {
          todaySpend: 0,
          weeklySpend: 0,
          monthlySpend: 0,
          totalSpend: 0,
          sessionCount: 0,
          averageSessionCost: 0,
          mostUsedCli: null,
        };
      }

      const r = results[0].values[0];
      return {
        todaySpend: Number(r[0]) || 0,
        weeklySpend: Number(r[1]) || 0,
        monthlySpend: Number(r[2]) || 0,
        totalSpend: Number(r[3]) || 0,
        sessionCount: Number(r[4]) || 0,
        averageSessionCost: Number(r[5]) || 0,
        mostUsedCli: (r[6] as string) ?? null,
      };
    } catch (error) {
      reply.code(500);
      return { error: { code: 'OVERVIEW_FAILED', message: 'Failed to load overview', details: String(error) } };
    }
  });
}
