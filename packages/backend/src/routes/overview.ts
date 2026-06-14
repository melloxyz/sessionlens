import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { visibleSessionSql } from '../db/session-filters.js';

export function registerOverviewRoutes(app: FastifyInstance): void {
  app.get('/api/overview/forecast', async (req, reply) => {
    try {
      const db = getDatabase();
      const now = new Date();

      const daysElapsed = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - daysElapsed;

      // Current calendar-month spend
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthResult = db.exec(
        `SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE ${visibleSessionSql()} AND started_at >= ?`,
        [monthStart],
      );
      const currentMonthSpend =
        monthResult.length > 0 && monthResult[0].values.length > 0
          ? Number(monthResult[0].values[0][0]) || 0
          : 0;

      // Daily spend for last 7 calendar days
      const since = new Date();
      since.setDate(now.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const sinceStr = since.toISOString();

      const dailyResult = db.exec(
        `SELECT DATE(started_at) AS day, COALESCE(SUM(total_cost_usd), 0) AS spend
         FROM sessions
         WHERE ${visibleSessionSql()} AND started_at >= ?
         GROUP BY DATE(started_at)
         ORDER BY day`,
        [sinceStr],
      );

      const dailyMap = new Map<string, number>();
      if (dailyResult.length > 0 && dailyResult[0].values) {
        for (const row of dailyResult[0].values) {
          dailyMap.set(String(row[0]), Number(row[1]) || 0);
        }
      }

      // Fill exactly 7 days (0 for missing days)
      const ys: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        ys.push(dailyMap.get(key) ?? 0);
      }

      // Simple linear regression: x ∈ [1..7]
      const n = 7;
      const sumX = 28; // 1+2+…+7
      const sumX2 = 140; // 1²+2²+…+7²
      const denom = n * sumX2 - sumX * sumX; // 196
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = ys.reduce((acc, y, i) => acc + (i + 1) * y, 0);
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;

      // Project each remaining day of the month
      let projectedRemaining = 0;
      for (let d = 1; d <= daysRemaining; d++) {
        projectedRemaining += Math.max(0, slope * (n + d) + intercept);
      }

      const projectedMonthSpend = currentMonthSpend + projectedRemaining;
      const avgDailySpend = sumY / n;
      const hasData = sumY > 0;

      return {
        currentMonthSpend: Math.round(currentMonthSpend * 10000) / 10000,
        projectedMonthSpend: Math.round(projectedMonthSpend * 10000) / 10000,
        daysElapsed,
        daysRemaining,
        daysInMonth,
        avgDailySpend: Math.round(avgDailySpend * 10000) / 10000,
        hasData,
      };
    } catch (error) {
      req.log.error(error, 'Failed to compute forecast');
      reply.code(500);
      return { error: { code: 'FORECAST_FAILED', message: 'Failed to compute monthly forecast' } };
    }
  });

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
          COALESCE(SUM(COALESCE(message_count, 0)), 0) AS total_messages,
          COALESCE(SUM(CASE WHEN cost_source = 'actual' THEN COALESCE(total_cost_usd, 0) ELSE 0 END), 0) AS confirmed_spend,
          COALESCE(SUM(CASE WHEN cost_source = 'estimated' THEN COALESCE(total_cost_usd, 0) ELSE 0 END), 0) AS estimated_spend
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
          confirmedSpend: 0,
          estimatedSpend: 0,
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
        confirmedSpend: Number(r[8]) || 0,
        estimatedSpend: Number(r[9]) || 0,
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
