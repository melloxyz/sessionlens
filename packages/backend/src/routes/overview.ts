import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { visibleSessionSql } from '../db/session-filters.js';

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
      if (dateFrom) {
        rangeClause += ' AND started_at >= ?';
        rangeParams.push(dateFrom);
      }
      if (dateTo) {
        rangeClause += ' AND started_at <= ?';
        rangeParams.push(dateTo);
      }
      const results = db.exec(
        `
        SELECT
          COALESCE(SUM(CASE WHEN started_at >= ? THEN COALESCE(total_cost_usd, 0) ELSE 0 END), 0) AS today_spend,
          COALESCE(SUM(CASE WHEN started_at >= ? THEN COALESCE(total_cost_usd, 0) ELSE 0 END), 0) AS weekly_spend,
          COALESCE(SUM(CASE WHEN started_at >= ? THEN COALESCE(total_cost_usd, 0) ELSE 0 END), 0) AS monthly_spend,
          COALESCE(SUM(total_cost_usd), 0) AS total_spend,
          COUNT(*) AS session_count,
          COALESCE(AVG(total_cost_usd), 0) AS avg_cost,
          COALESCE(SUM(COALESCE(duration_ms, 0)), 0) AS total_duration_ms,
          COALESCE(SUM(COALESCE(message_count, 0)), 0) AS total_messages
        FROM sessions
        WHERE ${visibleSessionSql()}${rangeClause}
      `,
        [todayStr, weekStr, monthStr, ...rangeParams],
      );
      const mostUsedCliResult = db.exec(
        `
        SELECT cli
        FROM sessions
        WHERE ${visibleSessionSql()}${rangeClause}
        GROUP BY cli
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
        rangeParams,
      );

      if (results.length === 0 || !results[0].values) {
        return {
          todaySpend: 0,
          weeklySpend: 0,
          monthlySpend: 0,
          totalSpend: 0,
          sessionCount: 0,
          averageSessionCost: 0,
          mostUsedCli: null,
          totalDurationMs: 0,
          totalMessages: 0,
        };
      }

      const r = results[0].values[0];
      const mostUsedCli = mostUsedCliResult[0]?.values?.[0]?.[0] as string | undefined;
      return {
        todaySpend: Number(r[0]) || 0,
        weeklySpend: Number(r[1]) || 0,
        monthlySpend: Number(r[2]) || 0,
        totalSpend: Number(r[3]) || 0,
        sessionCount: Number(r[4]) || 0,
        averageSessionCost: Number(r[5]) || 0,
        mostUsedCli: mostUsedCli ?? null,
        totalDurationMs: Number(r[6]) || 0,
        totalMessages: Number(r[7]) || 0,
      };
    } catch (error) {
      req.log.error(error, 'Failed to load overview');
      reply.code(500);
      return {
        error: {
          code: 'OVERVIEW_FAILED',
          message: 'Failed to load overview',
        },
      };
    }
  });
}
