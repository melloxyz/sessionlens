import 'dotenv/config';
import { initDatabase, runMigrations, seedModels } from './db/index.js';
import { registerAllAdapters } from './adapters/bootstrap.js';
import { runIngestion } from './ingestion/engine.js';
import { startAutoIngestion } from './ingestion/watcher.js';
import { syncOpenRouterPricing } from './openrouter.js';
import { buildApp } from './app.js';

const PORT = Number(process.env.SESSIONLENS_PORT) || 3030;
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.SESSIONLENS_FRONTEND_URL ? [process.env.SESSIONLENS_FRONTEND_URL] : []),
];

async function main() {
  try {
    await initDatabase();
    runMigrations();
    seedModels();
    registerAllAdapters();

    const app = await buildApp({ logger: true, allowedOrigins });

    await app.listen({ port: PORT, host: '127.0.0.1' });

    const gracefulShutdown = async () => {
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
