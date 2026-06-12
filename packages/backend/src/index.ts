import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { platform } from 'node:process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { initDatabase, runMigrations, seedModels } from './db/index.js';
import { getDatabase } from './db/connection.js';
import { type AdapterCapabilities, type SessionDataQuality, registry } from './adapters/index.js';
import { registerAllAdapters } from './adapters/bootstrap.js';
import { runIngestion, getLastStatus } from './ingestion/engine.js';
import {
  getAutoIngestionStatus,
  setAutoIngestionEnabled,
  startAutoIngestion,
} from './ingestion/watcher.js';
import { capabilityScore, summarizeQuality } from './ingestion/session-quality.js';
import { registerOverviewRoutes } from './routes/overview.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerModelRoutes } from './routes/models.js';
import { syncOpenRouterPricing } from './openrouter.js';
import { trayManager, isTrayEnabled } from './tray/index.js';
import { registerTrayRoutes } from './routes/tray.js';
import { registerBudgetRoutes } from './routes/budgets.js';
import { registerPrivacyRoutes } from './routes/privacy.js';

const PORT = Number(process.env.SESSIONLENS_PORT) || 3030;
const NO_TRAY = process.argv.includes('--no-tray');

async function main() {
  try {
    await initDatabase();
    runMigrations();
    seedModels();

    registerAllAdapters();

    const app = Fastify({ logger: true });
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      ...(process.env.SESSIONLENS_FRONTEND_URL ? [process.env.SESSIONLENS_FRONTEND_URL] : []),
    ];
    await app.register(cors, { origin: allowedOrigins });

    app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    registerOverviewRoutes(app);
    registerAnalyticsRoutes(app);
    registerSessionRoutes(app);
    registerProjectRoutes(app);
    registerModelRoutes(app);
    registerTrayRoutes(app);
    registerBudgetRoutes(app);
    registerPrivacyRoutes(app);

    app.get('/api/ingest/status', async () => {
      const status = getLastStatus();
      if (!status)
        return { message: 'No ingestion run yet', autoIngestion: getAutoIngestionStatus() };
      return status.errors.length > 0
        ? {
            ...status,
            autoIngestion: getAutoIngestionStatus(),
            error: { code: 'INGESTION_WARNINGS', message: 'Ingestion completed with warnings' },
          }
        : { ...status, autoIngestion: getAutoIngestionStatus() };
    });

    app.get('/api/ingest/auto', async () => getAutoIngestionStatus());

    app.post('/api/ingest/auto', async (req, reply) => {
      const body = req.body as { enabled?: unknown };
      if (typeof body?.enabled !== 'boolean') {
        return reply.status(400).send({
          error: { code: 'INVALID_AUTO_INGESTION_SETTING', message: 'enabled must be a boolean' },
        });
      }
      return setAutoIngestionEnabled(body.enabled);
    });

    app.get('/api/integrations/status', async () => {
      const adapters = registry.getAll();
      const resolved = await Promise.all(
        adapters.map(async (adapter) => {
          const detected = await adapter.detect();
          const sourceStats = getAdapterSourceStats(adapter.cli);
          const capabilities = adapter.getCapabilities?.() ?? unknownCapabilities();
          const dataQualitySummary = getCliDataQualitySummary(adapter.cli);
          return {
            cli: adapter.cli,
            detected,
            status: detected ? 'available' : 'missing',
            path: sourceStats.path ?? resolveIntegrationPath(adapter.cli, detected),
            pathsFound: sourceStats.pathsFound,
            sessionsIndexed: sourceStats.sessionsIndexed,
            lastIngestedAt: sourceStats.lastIngestedAt ?? getLastStatus()?.completedAt ?? null,
            lastError: sourceStats.lastError,
            capabilities,
            dataQualitySummary,
            completenessScore: capabilityScore(capabilities),
            sessionsZeroTokens: sourceStats.sessionsZeroTokens,
            sessionsNoCost: sourceStats.sessionsNoCost,
            sessionsNoModel: sourceStats.sessionsNoModel,
          };
        }),
      );
      return {
        integrations: resolved,
      };
    });

    app.post('/api/integrations/:cli/open', async (req, reply) => {
      try {
        const { cli } = req.params as { cli: string };
        const target = resolveIntegrationPath(cli, true);
        if (!target || !existsSync(target)) {
          reply.code(404);
          return {
            error: {
              code: 'INTEGRATION_PATH_NOT_FOUND',
              message: 'Integration folder not found',
            },
          };
        }

        openFolder(target);
        return { ok: true, path: target };
      } catch (error) {
        req.log.error(error, 'Failed to open integration folder');
        reply.code(500);
        return {
          error: {
            code: 'OPEN_INTEGRATION_FAILED',
            message: 'Failed to open integration folder',
          },
        };
      }
    });

    app.post('/api/ingest', async (req) => {
      const body = req.body as { force?: unknown } | undefined;
      const status = await runIngestion(body?.force === true);
      return status;
    });

    await app.listen({ port: PORT, host: '127.0.0.1' });

    if (!NO_TRAY && isTrayEnabled()) {
      await trayManager.init(app);
    }

    const gracefulShutdown = async () => {
      await trayManager.destroy();
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => {
      void gracefulShutdown();
    });
    process.on('SIGTERM', () => {
      void gracefulShutdown();
    });
    await startAutoIngestion(app.log);
    void (async () => {
      try {
        await syncOpenRouterPricing();
      } catch (err) {
        app.log.warn(err, 'OpenRouter pricing sync failed');
      }
      try {
        await runIngestion();
      } catch (err) {
        app.log.error(err, 'Initial ingestion failed');
      }
    })();
  } catch (err) {
    console.error('Sessionlens backend startup failed:', err);
    process.exit(1);
  }
}

void main();

function resolveIntegrationPath(cli: string, detected: boolean): string | null {
  const resolveFirstExisting = (...candidates: string[]) =>
    candidates.find((candidate) => existsSync(candidate)) ?? null;

  const known = cli.toLowerCase();
  const fallback =
    known === 'codex'
      ? join(homedir(), '.codex')
      : known === 'claude'
        ? join(homedir(), '.claude')
        : known === 'opencode'
          ? join(homedir(), '.local', 'share', 'opencode')
          : known === 'gemini'
            ? join(homedir(), '.gemini')
            : known === 'kimi'
              ? join(homedir(), '.kimi')
              : known === 'qwen'
                ? resolveFirstExisting(
                    join(homedir(), '.qwen'),
                    join(homedir(), '.config', 'qwen'),
                    join(homedir(), '.local', 'share', 'qwen'),
                  )
                : known === 'antigravity'
                  ? join(homedir(), '.gemini', 'antigravity')
                  : known === 'commandcode'
                    ? join(homedir(), '.commandcode')
                    : null;

  if (!fallback) return null;
  if (existsSync(fallback)) return fallback;
  return detected ? fallback : null;
}

function openFolder(target: string): void {
  const command =
    platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [target], { detached: true, stdio: 'ignore' });
  child.unref();
}

function getAdapterSourceStats(cli: string): {
  path: string | null;
  pathsFound: number;
  sessionsIndexed: number;
  lastIngestedAt: string | null;
  lastError: string | null;
  sessionsZeroTokens: number;
  sessionsNoCost: number;
  sessionsNoModel: number;
} {
  const db = getDatabase();
  const sourceResult = db.exec(
    `SELECT source_path, last_ingested_at, last_error
     FROM adapter_sources
     WHERE cli = ? AND detected = 1
     ORDER BY last_ingested_at DESC, source_path ASC
     LIMIT 1`,
    [cli],
  );
  const aggregateResult = db.exec(
    `SELECT COUNT(*) AS paths_found, COALESCE(SUM(session_count), 0) AS sessions_indexed,
            COALESCE(SUM(sessions_zero_tokens), 0) AS zero_tokens,
            COALESCE(SUM(sessions_no_cost), 0) AS no_cost,
            COALESCE(SUM(sessions_no_model), 0) AS no_model
     FROM adapter_sources WHERE cli = ? AND detected = 1`,
    [cli],
  );
  const fallbackSessionCount =
    Number(
      db.exec(`SELECT COUNT(*) FROM sessions WHERE cli = ?`, [cli])[0]?.values?.[0]?.[0] ?? 0,
    ) || 0;

  return {
    path: (sourceResult[0]?.values?.[0]?.[0] as string | undefined) ?? null,
    pathsFound: Number(aggregateResult[0]?.values?.[0]?.[0] ?? 0) || 0,
    sessionsIndexed: Number(aggregateResult[0]?.values?.[0]?.[1] ?? 0) || fallbackSessionCount,
    lastIngestedAt: (sourceResult[0]?.values?.[0]?.[1] as string | undefined) ?? null,
    lastError: (sourceResult[0]?.values?.[0]?.[2] as string | undefined) ?? null,
    sessionsZeroTokens: Number(aggregateResult[0]?.values?.[0]?.[2] ?? 0),
    sessionsNoCost: Number(aggregateResult[0]?.values?.[0]?.[3] ?? 0),
    sessionsNoModel: Number(aggregateResult[0]?.values?.[0]?.[4] ?? 0),
  };
}

function getCliDataQualitySummary(cli: string): SessionDataQuality {
  const db = getDatabase();
  const result = db.exec(`SELECT data_quality_json FROM sessions WHERE cli = ?`, [cli]);
  const rows: SessionDataQuality[] = [];

  for (const row of result[0]?.values ?? []) {
    const raw = row[0];
    if (typeof raw !== 'string' || raw.length === 0) continue;
    try {
      rows.push(JSON.parse(raw) as SessionDataQuality);
    } catch {
      // ignore malformed historic rows
    }
  }

  return summarizeQuality(rows);
}

function unknownCapabilities(): AdapterCapabilities {
  return {
    messages: 'unknown',
    tokens: 'unknown',
    cost: 'unknown',
    model: 'unknown',
    provider: 'unknown',
    projectPath: 'unknown',
    duration: 'unknown',
    toolCalls: 'unknown',
    fileReads: 'unknown',
    fileWrites: 'unknown',
    multiModel: 'unknown',
  };
}
