import { getDatabase, saveDatabase } from '../db/connection.js';
import { registry } from '../adapters/registry.js';
import type { RawSession } from '../adapters/types.js';
import { execSync } from 'node:child_process';

function normalizePath(p: string | null): string | null {
  if (!p) return null;
  return p.replace(/^\\\\\?\\/, '');
}

export interface IngestionStatus {
  totalSessions: number;
  newSessions: number;
  updatedSessions: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
  adapters: Record<string, { detected: boolean; paths: number }>;
}

let lastStatus: IngestionStatus | null = null;

export function getLastStatus(): IngestionStatus | null {
  return lastStatus;
}

export async function runIngestion(): Promise<IngestionStatus> {
  const db = getDatabase();
  const errors: string[] = [];
  let newSessions = 0;
  let updatedSessions = 0;
  const adapterInfo: Record<string, { detected: boolean; paths: number }> = {};

  const status: IngestionStatus = {
    totalSessions: 0,
    newSessions,
    updatedSessions,
    errors,
    startedAt: new Date().toISOString(),
    completedAt: null,
    adapters: adapterInfo,
  };
  lastStatus = status;

  for (const adapter of registry.getAll()) {
    try {
      const detected = await adapter.detect();
      adapterInfo[adapter.cli] = { detected, paths: 0 };

      if (!detected) continue;

      const sessionPaths = await adapter.discover();
      adapterInfo[adapter.cli].paths = sessionPaths.length;

      for (const sessionPath of sessionPaths) {
        try {
          const checkpoint = registry.getCheckpoint(adapter.cli, sessionPath);
          const rawSessions = await adapter.parse(sessionPath, checkpoint);

          for (const raw of rawSessions) {
            const normalized = adapter.normalize(raw);
            const result = upsertSession(normalized);
            if (result === 'new') newSessions++;
            else if (result === 'updated') updatedSessions++;
          }

          const newCheckpoint = await adapter.computeCheckpoint(sessionPath);
          if (newCheckpoint) {
            registry.saveCheckpoint(adapter.cli, sessionPath, newCheckpoint);
          }
        } catch (err) {
          errors.push(`${adapter.cli}/${sessionPath}: ${String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`${adapter.cli}: ${String(err)}`);
    }
  }

  try {
    refreshProjects();
  } catch (err) {
    errors.push(`refresh-projects: ${String(err)}`);
  }

  status.newSessions = newSessions;
  status.updatedSessions = updatedSessions;
  status.totalSessions = countSessions();
  status.completedAt = new Date().toISOString();
  saveDatabase();

  return status;
}

function upsertSession(raw: RawSession): 'new' | 'updated' | 'skipped' {
  const db = getDatabase();

  const existing = db.exec(
    `SELECT id FROM sessions WHERE session_id = ? AND cli = ? AND provider = ?`,
    [raw.sessionId, raw.cli, raw.provider],
  );

  let sessionPk: number;

  if (existing.length > 0 && existing[0].values.length > 0) {
    sessionPk = Number(existing[0].values[0][0]);
    db.run(
      `UPDATE sessions SET
        project_path = ?, model = ?, started_at = ?, ended_at = ?,
        duration_ms = ?, total_cost_usd = COALESCE(total_cost_usd, ?),
        source_confidence = ?, message_count = ?, tool_call_count = ?
      WHERE id = ?`,
      [
        normalizePath(raw.projectPath),
        raw.model,
        raw.startedAt,
        raw.endedAt,
        raw.durationMs,
        raw.totalCostUsd,
        raw.sourceConfidence,
        raw.messages.length,
        raw.usageEvents.reduce((sum, e) => sum + e.toolCallsCount, 0),
        sessionPk,
      ],
    );
    db.run(`DELETE FROM usage_events WHERE session_fk = ?`, [sessionPk]);
    db.run(`DELETE FROM messages WHERE session_fk = ?`, [sessionPk]);
    insertEvents(db, sessionPk, raw);
    return 'updated';
  }

  db.run(
    `INSERT INTO sessions (provider, cli, session_id, project_path, model, started_at, ended_at, duration_ms, total_cost_usd, source_confidence, message_count, tool_call_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      raw.provider,
      raw.cli,
      raw.sessionId,
      normalizePath(raw.projectPath),
      raw.model,
      raw.startedAt,
      raw.endedAt,
      raw.durationMs,
      raw.totalCostUsd,
      raw.sourceConfidence,
      raw.messages.length,
      raw.usageEvents.reduce((sum, e) => sum + e.toolCallsCount, 0),
    ],
  );

  const lastId = db.exec(`SELECT last_insert_rowid()`);
  sessionPk = Number(lastId[0].values[0][0]);
  insertEvents(db, sessionPk, raw);
  return 'new';
}

function insertEvents(
  db: ReturnType<typeof getDatabase>,
  sessionFk: number,
  raw: RawSession,
): void {
  for (const msg of raw.messages) {
    db.run(
      `INSERT INTO messages (session_fk, role, content, timestamp) VALUES (?, ?, ?, ?)`,
      [sessionFk, msg.role, msg.content.substring(0, 10000), msg.timestamp],
    );
  }

  for (const ue of raw.usageEvents) {
    db.run(
      `INSERT INTO usage_events (session_fk, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, tool_calls_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionFk,
        ue.timestamp,
        ue.inputTokens,
        ue.outputTokens,
        ue.cacheReadTokens,
        ue.cacheWriteTokens,
        ue.reasoningTokens,
        ue.toolCallsCount,
      ],
    );
  }
}

function refreshProjects(): void {
  const db = getDatabase();

  db.run(`DELETE FROM projects`);

  db.run(`
    INSERT INTO projects (path, total_sessions, total_cost)
    SELECT
      COALESCE(project_path, 'unknown'),
      COUNT(*),
      COALESCE(SUM(total_cost_usd), 0)
    FROM sessions
    GROUP BY COALESCE(project_path, 'unknown')
    ORDER BY COALESCE(SUM(total_cost_usd), 0) DESC
  `);

  const projects = db.exec(`SELECT id, path FROM projects WHERE path != 'unknown'`);
  if (projects.length > 0 && projects[0].values) {
    for (const row of projects[0].values) {
      const id = Number(row[0]);
      const p = normalizePath(row[1] as string) ?? '';
      try {
        const result = execSync('git remote get-url origin', {
          cwd: p,
          encoding: 'utf-8',
          timeout: 3000,
        });
        const remote = result.trim();
        if (remote) {
          db.run(`UPDATE projects SET git_remote = ? WHERE id = ?`, [remote, id]);
        }
      } catch {
        // not a git repo or no remote
      }
    }
  }
}

function countSessions(): number {
  const db = getDatabase();
  const result = db.exec(`SELECT COUNT(*) FROM sessions`);
  if (result.length > 0 && result[0].values.length > 0) {
    return Number(result[0].values[0][0]);
  }
  return 0;
}
