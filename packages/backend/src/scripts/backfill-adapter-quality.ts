import { initDatabase, runMigrations, seedModels } from '../db/index.js';
import { registerAllAdapters } from '../adapters/bootstrap.js';
import { runIngestion } from '../ingestion/engine.js';

async function main() {
  await initDatabase();
  runMigrations();
  seedModels();
  registerAllAdapters();

  const status = await runIngestion();
  console.log(
    JSON.stringify(
      {
        mode: 'backfill',
        completedAt: status.completedAt,
        totalSessions: status.totalSessions,
        newSessions: status.newSessions,
        updatedSessions: status.updatedSessions,
        errors: status.errors,
        adapters: status.adapters,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error('adapter backfill failed');
  console.error(error);
  process.exit(1);
});
