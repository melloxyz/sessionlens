import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';

export function registerOverviewRoutes(app: FastifyInstance): void {
  app.get('/api/overview', async () => {
    const db = getDatabase();
    const now = new Date().toISOString();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStr = weekStart.toISOString();

    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    const monthStr = monthStart.toISOString();

    const results = db.exec(`
      SELECT
        (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE started_at >= ?) AS today_spend,
        (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE started_at >= ?) AS weekly_spend,
        (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions WHERE started_at >= ?) AS monthly_spend,
        (SELECT COALESCE(SUM(total_cost_usd), 0) FROM sessions) AS total_spend,
        (SELECT COUNT(*) FROM sessions) AS session_count,
        (SELECT COALESCE(AVG(total_cost_usd), 0) FROM sessions WHERE total_cost_usd IS NOT NULL) AS avg_cost,
        (SELECT cli FROM sessions GROUP BY cli ORDER BY COUNT(*) DESC LIMIT 1) AS most_used_cli
    `, [todayStr, weekStr, monthStr]);

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
  });
}
