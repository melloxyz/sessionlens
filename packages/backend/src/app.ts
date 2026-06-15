import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerOverviewRoutes } from './routes/overview.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerModelRoutes } from './routes/models.js';
import { registerBudgetRoutes } from './routes/budgets.js';
import { registerPrivacyRoutes } from './routes/privacy.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerExportRoutes } from './routes/export.js';
import { registerIngestRoutes } from './routes/ingest.js';
import { registerIntegrationsRoutes } from './routes/integrations.js';

export interface BuildAppOptions {
  logger?: boolean;
  allowedOrigins?: string[];
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, {
    origin: opts.allowedOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  registerOverviewRoutes(app);
  registerAnalyticsRoutes(app);
  registerSessionRoutes(app);
  registerProjectRoutes(app);
  registerModelRoutes(app);
  registerBudgetRoutes(app);
  registerPrivacyRoutes(app);
  registerNotificationRoutes(app);
  registerExportRoutes(app);
  registerIngestRoutes(app);
  registerIntegrationsRoutes(app);

  return app;
}
