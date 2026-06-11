import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { join, dirname } from 'node:path';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';

let db: SqlJsDatabase | null = null;
let dbPath: string;

const MAX_BACKUPS = 3;

export function getDbPath(): string {
  return process.env.DATABASE_PATH || join(process.cwd(), 'data', 'sessionlens.db');
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function checkIntegrity(database: SqlJsDatabase): boolean {
  try {
    const result = database.exec('PRAGMA integrity_check');
    if (result.length === 0 || result[0].values.length === 0) return false;
    return result[0].values[0][0] === 'ok';
  } catch {
    return false;
  }
}

function rotateBackups(): void {
  for (let i = MAX_BACKUPS; i >= 2; i--) {
    const src = `${dbPath}.bak.${i - 1}`;
    const dst = `${dbPath}.bak.${i}`;
    if (existsSync(src)) {
      try {
        renameSync(src, dst);
      } catch {
        /* ignore */
      }
    }
  }
  if (existsSync(dbPath)) {
    try {
      copyFileSync(dbPath, `${dbPath}.bak.1`);
    } catch {
      /* ignore */
    }
  }
}

export async function initDatabase(): Promise<void> {
  dbPath = getDbPath();
  const dir = dirname(dbPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Clean up any leftover temp file from a previous aborted save
  const tmpPath = `${dbPath}.tmp`;
  if (existsSync(tmpPath)) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }

  const legacyPath = join(dir, ['ai', 'meter.db'].join(''));
  if (!existsSync(dbPath) && existsSync(legacyPath)) {
    copyFileSync(legacyPath, dbPath);
  }

  const SQL = await initSqlJs();

  function tryLoad(path: string): SqlJsDatabase | null {
    if (!existsSync(path)) return null;
    try {
      const buffer = readFileSync(path);
      const candidate = new SQL.Database(buffer);
      if (checkIntegrity(candidate)) return candidate;
      candidate.close();
      return null;
    } catch {
      return null;
    }
  }

  let loaded = tryLoad(dbPath);

  if (!loaded) {
    for (let i = 1; i <= MAX_BACKUPS; i++) {
      loaded = tryLoad(`${dbPath}.bak.${i}`);
      if (loaded) {
        console.warn(`[db] Main database failed integrity check; restored from backup .bak.${i}`);
        break;
      }
    }
  }

  db = loaded ?? new SQL.Database();
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const tmp = `${dbPath}.tmp`;
  writeFileSync(tmp, buffer);
  rotateBackups();
  renameSync(tmp, dbPath);
}

export function closeDatabase(): void {
  if (!db) return;
  saveDatabase();
  db.close();
  db = null;
}
