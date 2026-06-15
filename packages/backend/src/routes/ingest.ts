import type { FastifyInstance } from 'fastify';
import { runIngestion, getLastStatus } from '../ingestion/engine.js';
import { getAutoIngestionStatus, setAutoIngestionEnabled } from '../ingestion/watcher.js';

export function registerIngestRoutes(app: FastifyInstance): void {
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

  app.post('/api/ingest', async (req) => {
    const body = req.body as { force?: unknown } | undefined;
    return runIngestion(body?.force === true);
  });
}
