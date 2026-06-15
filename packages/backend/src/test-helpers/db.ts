import initSqlJs from 'sql.js';
import { _setDatabaseForTesting, _clearDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedModels } from '../db/seed.js';

export interface TestDbHandle {
  cleanup(): void;
}

export async function setupTestDb(): Promise<TestDbHandle> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  _setDatabaseForTesting(db);
  runMigrations();
  seedModels();
  return {
    cleanup() {
      db.close();
      _clearDatabase();
    },
  };
}
