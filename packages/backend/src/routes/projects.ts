import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getDatabase, saveDatabase } from '../db/connection.js';

export function registerProjectRoutes(app: FastifyInstance): void {
  app.get('/api/projects', async (req, reply) => {
    try {
      const q = req.query as Record<string, string>;
      const db = getDatabase();
      const search = q.search || null;

      let sql = `SELECT * FROM projects WHERE NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = projects.path)`;
      const params: (string | number | null)[] = [];
      if (search) {
        sql += ` AND path LIKE ?`;
        params.push(`%${search}%`);
      }
      sql += ` ORDER BY total_cost DESC`;

      const results = db.exec(sql, params);
      const data: Record<string, unknown>[] = [];

      if (results.length > 0 && results[0].values && results[0].columns) {
        const cols = results[0].columns;
        for (const row of results[0].values) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) {
            obj[cols[i]] = row[i];
          }
          obj.exists =
            typeof obj.path === 'string' && obj.path !== 'unknown' ? existsSync(obj.path) : false;
          data.push(obj);
        }
      }

      return { data };
    } catch (error) {
      reply.code(500);
      return {
        error: {
          code: 'PROJECTS_FAILED',
          message: 'Failed to load projects',
          details: String(error),
        },
      };
    }
  });

  app.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDatabase();

    const projResult = db.exec(
      `SELECT * FROM projects WHERE id = ? AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = projects.path)`,
      [Number(id)],
    );
    if (projResult.length === 0 || !projResult[0].values || projResult[0].values.length === 0) {
      reply.code(404);
      return { error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } };
    }

    const proj: Record<string, unknown> = {};
    const cols = projResult[0].columns;
    const row = projResult[0].values[0];
    for (let i = 0; i < cols.length; i++) proj[cols[i]] = row[i];
    proj.exists =
      typeof proj.path === 'string' && proj.path !== 'unknown' ? existsSync(proj.path) : false;

    const path = proj.path as string;

    // Sessions for this project
    const sessionResult = db.exec(
      `SELECT id, cli, model, started_at, ended_at, duration_ms, total_cost_usd, cost_source, source_confidence, message_count, tool_call_count
       FROM sessions WHERE COALESCE(project_path, 'unknown') = ? ORDER BY started_at DESC LIMIT 100`,
      [path],
    );
    const sessions: Record<string, unknown>[] = [];
    if (sessionResult.length > 0 && sessionResult[0].values) {
      const sc = sessionResult[0].columns;
      for (const r of sessionResult[0].values) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < sc.length; i++) obj[sc[i]] = r[i];
        sessions.push(obj);
      }
    }

    // Provider breakdown
    const providerResult = db.exec(
      `SELECT provider, COUNT(*) as cnt, COALESCE(SUM(total_cost_usd), 0) as cost
       FROM sessions WHERE COALESCE(project_path, 'unknown') = ? GROUP BY provider ORDER BY cost DESC`,
      [path],
    );
    const providerBreakdown: Record<string, unknown>[] = [];
    if (providerResult.length > 0 && providerResult[0].values) {
      const pc = providerResult[0].columns;
      for (const r of providerResult[0].values) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < pc.length; i++) obj[pc[i]] = r[i];
        providerBreakdown.push(obj);
      }
    }

    // Model breakdown
    const modelResult = db.exec(
      `SELECT COALESCE(model, 'unknown') as model, COUNT(*) as cnt, COALESCE(SUM(total_cost_usd), 0) as cost
       FROM sessions WHERE COALESCE(project_path, 'unknown') = ? GROUP BY model ORDER BY cost DESC`,
      [path],
    );
    const modelBreakdown: Record<string, unknown>[] = [];
    if (modelResult.length > 0 && modelResult[0].values) {
      const mc = modelResult[0].columns;
      for (const r of modelResult[0].values) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < mc.length; i++) obj[mc[i]] = r[i];
        modelBreakdown.push(obj);
      }
    }

    // Spend over time for project
    const spendResult = db.exec(
      `SELECT date(started_at) as day, COALESCE(SUM(total_cost_usd), 0) as spend, COUNT(*) as cnt
       FROM sessions WHERE COALESCE(project_path, 'unknown') = ? AND total_cost_usd IS NOT NULL
       GROUP BY day ORDER BY day`,
      [path],
    );
    const spendOverTime: Record<string, unknown>[] = [];
    if (spendResult.length > 0 && spendResult[0].values) {
      const sc2 = spendResult[0].columns;
      for (const r of spendResult[0].values) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < sc2.length; i++) obj[sc2[i]] = r[i];
        spendOverTime.push(obj);
      }
    }

    const commits = getGitCommits(path);
    return { project: proj, sessions, providerBreakdown, modelBreakdown, spendOverTime, commits };
  });

  app.delete('/api/projects/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const db = getDatabase();
      const result = db.exec(`SELECT path FROM projects WHERE id = ?`, [Number(id)]);
      const path = result[0]?.values?.[0]?.[0] as string | undefined;
      if (!path) {
        reply.code(404);
        return { error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } };
      }
      db.run(
        `INSERT OR REPLACE INTO hidden_projects (path, hidden_at) VALUES (?, datetime('now'))`,
        [path],
      );
      saveDatabase();
      return { ok: true };
    } catch (error) {
      reply.code(500);
      return {
        error: {
          code: 'PROJECT_HIDE_FAILED',
          message: 'Failed to hide project',
          details: String(error),
        },
      };
    }
  });
}

function getGitCommits(path: string): {
  branch: string | null;
  commits: { hash: string; author: string; date: string; message: string }[];
} {
  if (!path || path === 'unknown' || !existsSync(path)) return { branch: null, commits: [] };
  try {
    const branch =
      execFileSync('git', ['-C', path, 'rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim() || null;
    const log = execFileSync(
      'git',
      [
        '-C',
        path,
        'log',
        '-n',
        '20',
        '--date=iso-strict',
        '--pretty=format:%h%x1f%an%x1f%ad%x1f%s',
      ],
      { encoding: 'utf-8', timeout: 3000 },
    );
    const commits = log
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, message] = line.split('\x1f');
        return { hash: hash ?? '', author: author ?? '', date: date ?? '', message: message ?? '' };
      });
    return { branch, commits };
  } catch {
    return { branch: null, commits: [] };
  }
}
