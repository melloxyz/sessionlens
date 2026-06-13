import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, saveDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = resolveMigrationsDir();

function resolveMigrationsDir(): string {
  const compiledDir = join(__dirname, 'migrations');
  if (existsSync(compiledDir)) return compiledDir;

  const sourceDir = join(__dirname, '..', '..', 'src', 'db', 'migrations');
  if (existsSync(sourceDir)) return sourceDir;

  return compiledDir;
}

export function runMigrations(): void {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    '0000_init',
    '0001_session_model_usage',
    '0002_expand_cli_check',
    '0003_cost_source_hidden_projects',
    '0004_pricing_aliases',
    '0005_app_settings',
    '0006_budget_alerts',
    '0007_commandcode_cli',
    '0008_adapter_data_quality',
    '0009_adapter_drift_counters',
    '0010_notification_webhooks',
    '0011_notification_cooldown',
  ];

  for (const name of migrations) {
    const result = db.exec(`SELECT name FROM __migrations WHERE name = ?`, [name]);
    const alreadyApplied = result.length > 0 && result[0].values.length > 0;
    if (alreadyApplied) continue;

    if (ensureMigrationSatisfied(name)) {
      db.run(`INSERT INTO __migrations (name) VALUES (?)`, [name]);
      continue;
    }

    const sqlPath = join(MIGRATIONS_DIR, `${name}.sql`);
    if (!existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sql = readFileSync(sqlPath, 'utf-8');
    db.run(sql);
    db.run(`INSERT INTO __migrations (name) VALUES (?)`, [name]);
  }

  saveDatabase();
}

function ensureMigrationSatisfied(name: string): boolean {
  const db = getDatabase();

  if (name === '0003_cost_source_hidden_projects') {
    const hasCostSource = columnExists('sessions', 'cost_source');
    if (!hasCostSource) {
      db.run(
        `ALTER TABLE sessions ADD COLUMN cost_source TEXT NOT NULL DEFAULT 'unknown' CHECK(cost_source IN ('actual', 'estimated', 'unknown'))`,
      );
    }
    db.run(`
      CREATE TABLE IF NOT EXISTS hidden_projects (
        path TEXT PRIMARY KEY,
        hidden_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_hidden_projects_path ON hidden_projects(path)`);
    return true;
  }

  if (name === '0008_adapter_data_quality') {
    if (!columnExists('sessions', 'source_path')) {
      db.run(`ALTER TABLE sessions ADD COLUMN source_path TEXT`);
    }
    if (!columnExists('sessions', 'data_quality_json')) {
      db.run(`ALTER TABLE sessions ADD COLUMN data_quality_json TEXT`);
    }
    if (!columnExists('sessions', 'raw_tool_call_count')) {
      db.run(`ALTER TABLE sessions ADD COLUMN raw_tool_call_count INTEGER NOT NULL DEFAULT 0`);
    }

    if (!tableExists('session_tools')) {
      db.run(`
        CREATE TABLE session_tools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          timestamp TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          operation TEXT NOT NULL,
          input_json TEXT,
          output_preview TEXT,
          source_confidence TEXT NOT NULL CHECK(source_confidence IN ('high', 'medium', 'low'))
        )
      `);
      db.run(`CREATE INDEX idx_session_tools_session ON session_tools(session_fk)`);
      db.run(`CREATE INDEX idx_session_tools_timestamp ON session_tools(timestamp)`);
    }

    if (!tableExists('session_files')) {
      db.run(`
        CREATE TABLE session_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          path TEXT,
          operation TEXT NOT NULL CHECK(operation IN ('read', 'write', 'edit', 'delete', 'shell_possible', 'unknown')),
          tool_name TEXT,
          timestamp TEXT NOT NULL,
          confidence TEXT NOT NULL CHECK(confidence IN ('high', 'medium', 'low')),
          metadata_json TEXT
        )
      `);
      db.run(`CREATE INDEX idx_session_files_session ON session_files(session_fk)`);
      db.run(`CREATE INDEX idx_session_files_path ON session_files(path)`);
    }

    if (!tableExists('adapter_sources')) {
      db.run(`
        CREATE TABLE adapter_sources (
          cli TEXT NOT NULL,
          source_path TEXT NOT NULL,
          detected INTEGER NOT NULL DEFAULT 0,
          source_type TEXT,
          last_seen_at TEXT,
          last_ingested_at TEXT,
          last_error TEXT,
          file_count INTEGER NOT NULL DEFAULT 0,
          session_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (cli, source_path)
        )
      `);
      db.run(`CREATE INDEX idx_adapter_sources_cli ON adapter_sources(cli)`);
    }

    return true;
  }

  if (name === '0011_notification_cooldown') {
    if (!columnExists('notification_destinations', 'min_interval_minutes')) {
      db.run(
        `ALTER TABLE notification_destinations ADD COLUMN min_interval_minutes INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!columnExists('notification_destinations', 'last_notified_at')) {
      db.run(`ALTER TABLE notification_destinations ADD COLUMN last_notified_at TEXT`);
    }
    return true;
  }

  if (name === '0009_adapter_drift_counters') {
    if (!columnExists('adapter_sources', 'sessions_zero_tokens')) {
      db.run(
        `ALTER TABLE adapter_sources ADD COLUMN sessions_zero_tokens INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!columnExists('adapter_sources', 'sessions_no_cost')) {
      db.run(`ALTER TABLE adapter_sources ADD COLUMN sessions_no_cost INTEGER NOT NULL DEFAULT 0`);
    }
    if (!columnExists('adapter_sources', 'sessions_no_model')) {
      db.run(`ALTER TABLE adapter_sources ADD COLUMN sessions_no_model INTEGER NOT NULL DEFAULT 0`);
    }
    return true;
  }

  return false;
}

function columnExists(table: string, column: string): boolean {
  const db = getDatabase();
  const result = db.exec(`PRAGMA table_info(${table})`);
  return (result[0]?.values ?? []).some((row) => row[1] === column);
}

function tableExists(table: string): boolean {
  const db = getDatabase();
  const result = db.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [
    table,
  ]);
  return (result[0]?.values ?? []).length > 0;
}
