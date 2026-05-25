import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase, runMigrations, seedModels } from './db/index.js';
import { createCodexAdapter, createClaudeAdapter, registry } from './adapters/index.js';
import { runIngestion, getLastStatus } from './ingestion/engine.js';

const PORT = Number(process.env.AIMETER_PORT) || 3030;

async function main() {
  // Database
  await initDatabase();
  runMigrations();
  seedModels();

  // Register adapters
  registry.register(createCodexAdapter());
  registry.register(createClaudeAdapter());

  // Server
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/ingest/status', async () => {
    return getLastStatus() ?? { message: 'No ingestion run yet' };
  });

  app.post('/api/ingest', async () => {
    const status = await runIngestion();
    return status;
  });

  // Auto-run ingestion on startup
  try {
    await runIngestion();
  } catch (err) {
    app.log.error(err, 'Initial ingestion failed');
  }

  try {
    await app.listen({ port: PORT, host: '127.0.0.1' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
