import { getDatabase, saveDatabase } from '../db/connection.js';
import { registry } from '../adapters/registry.js';
import type { RawFileEvent, RawModelUsage, RawSession, RawToolEvent } from '../adapters/types.js';
import { execFileSync } from 'node:child_process';
import { resolveSessionCost, initPricingCache, clearPricingCache } from '../costing.js';
import { buildSessionDataQuality, countToolCalls } from './session-quality.js';
import { validSessionSql } from '../db/session-filters.js';
import { normalizeProvider, normalizeModel } from '../db/normalize.js';
import { getBooleanSetting } from '../db/settings.js';
import { redactText, redactInput } from '../privacy/redact.js';

function normalizePath(p: string | null): string | null {
  if (!p) return null;
  return p.replace(/^\\\\\?\\/, '');
}

function resolveToolCallCount(raw: RawSession): number {
  return countToolCalls(raw);
}

function resolveDataQuality(raw: RawSession, costSource: 'actual' | 'estimated' | 'unknown') {
  return buildSessionDataQuality(raw, costSource);
}

function persistToolEvents(
  db: ReturnType<typeof getDatabase>,
  sessionPk: number,
  rows: RawToolEvent[],
  redact: boolean,
): void {
  db.run(`DELETE FROM session_tools WHERE session_fk = ?`, [sessionPk]);

  for (const row of rows) {
    const input = redact && row.input ? redactInput(row.input) : row.input;
    const outputPreview =
      redact && row.outputPreview ? redactText(row.outputPreview) : (row.outputPreview ?? null);
    db.run(
      `INSERT INTO session_tools (session_fk, timestamp, tool_name, operation, input_json, output_preview, source_confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionPk,
        row.timestamp,
        row.toolName,
        row.operation,
        input ? JSON.stringify(input) : null,
        outputPreview,
        row.sourceConfidence,
      ],
    );
  }
}

function persistFileEvents(
  db: ReturnType<typeof getDatabase>,
  sessionPk: number,
  rows: RawFileEvent[],
): void {
  db.run(`DELETE FROM session_files WHERE session_fk = ?`, [sessionPk]);

  for (const row of rows) {
    db.run(
      `INSERT INTO session_files (session_fk, path, operation, tool_name, timestamp, confidence, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionPk,
        normalizePath(row.path),
        row.operation,
        row.toolName,
        row.timestamp,
        row.confidence,
        row.metadata ? JSON.stringify(row.metadata) : null,
      ],
    );
  }
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
let activeIngestion: Promise<IngestionStatus> | null = null;

export function getLastStatus(): IngestionStatus | null {
  return lastStatus;
}

export function _resetIngestionState(): void {
  lastStatus = null;
  activeIngestion = null;
}

export function isIngestionRunning(): boolean {
  return activeIngestion !== null;
}

export async function runIngestion(forceReprocess = false): Promise<IngestionStatus> {
  if (activeIngestion) return activeIngestion;
  activeIngestion = runIngestionInternal(forceReprocess).finally(() => {
    activeIngestion = null;
  });
  return activeIngestion;
}

async function runIngestionInternal(forceReprocess = false): Promise<IngestionStatus> {
  const _db = getDatabase();
  const redact = getBooleanSetting('privacy.redactSensitiveData', false);
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
      markAdapterSourcesDetected(adapter.cli, detected);

      if (!detected) continue;

      await adapter.onIngestionStart?.();
      try {
        const sessionPaths = await adapter.discover();
        adapterInfo[adapter.cli].paths = sessionPaths.length;
        persistDiscoveredSources(adapter.cli, sessionPaths);

        for (const sessionPath of sessionPaths) {
          try {
            const checkpoint = forceReprocess
              ? null
              : registry.getCheckpoint(adapter.cli, sessionPath);
            const rawSessions = await adapter.parse(sessionPath, checkpoint);

            let pathZeroTokens = 0;
            let pathNoCost = 0;
            let pathNoModel = 0;

            for (const raw of rawSessions) {
              const normalized = adapter.normalize(raw);
              const result = upsertSession(normalized, redact);
              if (result === 'new') newSessions++;
              else if (result === 'updated') updatedSessions++;

              const totalTokens = normalized.usageEvents.reduce(
                (sum, e) => sum + (e.inputTokens ?? 0) + (e.outputTokens ?? 0),
                0,
              );
              if (totalTokens === 0) pathZeroTokens++;
              if (normalized.totalCostUsd == null) pathNoCost++;
              if (!normalized.model) pathNoModel++;
            }

            recordAdapterSource(adapter.cli, sessionPath, {
              detected: true,
              sessionCount: rawSessions.length,
              lastError: null,
              ...(rawSessions.length > 0
                ? {
                    sessionsZeroTokens: pathZeroTokens,
                    sessionsNoCost: pathNoCost,
                    sessionsNoModel: pathNoModel,
                  }
                : {}),
            });

            const newCheckpoint = await adapter.computeCheckpoint(sessionPath);
            if (newCheckpoint) {
              registry.saveCheckpoint(adapter.cli, sessionPath, newCheckpoint);
            }
          } catch (err) {
            recordAdapterSource(adapter.cli, sessionPath, {
              detected: true,
              lastError: String(err),
            });
            errors.push(`${adapter.cli}/${sessionPath}: ${String(err)}`);
          }
        }
      } finally {
        await adapter.onIngestionEnd?.();
      }
    } catch (err) {
      errors.push(`${adapter.cli}: ${String(err)}`);
    }
  }

  try {
    deleteInvalidSessions();
    backfillEstimatedCosts(forceReprocess);
    refreshProjects();
  } catch (err) {
    errors.push(`refresh-projects: ${String(err)}`);
  }

  status.newSessions = newSessions;
  status.updatedSessions = updatedSessions;
  status.totalSessions = countSessions();
  status.completedAt = new Date().toISOString();
  saveDatabase();

  const { checkBudgets } = await import('../analytics/budgets.js');
  let budgetAlerts: {
    type: string;
    title: string;
    message: string;
    current_spend: number;
    limit_usd: number;
  }[] = [];
  try {
    budgetAlerts = checkBudgets();
  } catch {
    // budget check failure should not break ingestion
  }

  // Fire-and-forget webhook notifications
  import('../notifications/dispatcher.js')
    .then(({ dispatchNotification }) => {
      const budgetEventMap: Record<
        string,
        'budget_warning' | 'budget_approaching' | 'budget_exceeded'
      > = {
        warning: 'budget_warning',
        approaching: 'budget_approaching',
        exceeded: 'budget_exceeded',
      };
      for (const alert of budgetAlerts) {
        const evtType = budgetEventMap[alert.type];
        if (evtType) {
          void dispatchNotification({
            type: evtType,
            title: alert.title,
            message: alert.message,
            currentSpend: alert.current_spend,
            limitUsd: alert.limit_usd,
            percentage: alert.limit_usd > 0 ? (alert.current_spend / alert.limit_usd) * 100 : 0,
          }).catch(() => {});
        }
      }
      void dispatchNotification({
        type: 'ingestion_complete',
        newSessions: status.newSessions,
        updatedSessions: status.updatedSessions,
        totalSessions: status.totalSessions,
        errors,
      }).catch(() => {});
    })
    .catch(() => {});

  return status;
}

function deleteInvalidSessions(): void {
  const db = getDatabase();
  db.run(`DELETE FROM sessions WHERE NOT (${validSessionSql()})`);
}

function persistModelUsage(sessionPk: number, rows: RawModelUsage[]): void {
  const db = getDatabase();
  db.run(`DELETE FROM session_model_usage WHERE session_fk = ?`, [sessionPk]);

  for (const row of rows) {
    db.run(
      `INSERT INTO session_model_usage (
        session_fk, provider, model, message_count, input_tokens, output_tokens,
        reasoning_tokens, cache_read_tokens, cache_write_tokens, tool_calls_count, total_cost_usd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionPk,
        row.provider,
        row.model,
        row.messageCount,
        row.inputTokens,
        row.outputTokens,
        row.reasoningTokens,
        row.cacheReadTokens,
        row.cacheWriteTokens,
        row.toolCallsCount,
        row.totalCostUsd,
      ],
    );
  }
}

function upsertSession(raw: RawSession, redact: boolean): 'new' | 'updated' | 'skipped' {
  const db = getDatabase();

  const normalizedProvider = normalizeProvider(raw.provider);
  const normalizedModel = normalizeModel(raw.model);
  const cost = resolveSessionCost({ ...raw, provider: normalizedProvider, model: normalizedModel });
  const toolCallCount = resolveToolCallCount(raw);
  const dataQuality = resolveDataQuality(raw, cost.costSource);
  const sourcePath = normalizePath(raw.sourcePath ?? null);

  const existing = db.exec(
    `SELECT id FROM sessions WHERE session_id = ? AND cli = ? AND provider = ?`,
    [raw.sessionId, raw.cli, normalizedProvider],
  );

  let sessionPk: number;

  if (existing.length > 0 && existing[0].values.length > 0) {
    sessionPk = Number(existing[0].values[0][0]);
    db.run(
      `UPDATE sessions SET
        project_path = ?, model = ?, started_at = ?, ended_at = ?,
        duration_ms = ?, total_cost_usd = ?, cost_source = ?,
        source_confidence = ?, message_count = ?, tool_call_count = ?,
        raw_tool_call_count = ?, source_path = ?, data_quality_json = ?,
        title = COALESCE(?, title),
        git_origin_url = COALESCE(?, git_origin_url),
        git_branch = COALESCE(?, git_branch),
        is_automated = ?
      WHERE id = ?`,
      [
        normalizePath(raw.projectPath),
        normalizedModel,
        raw.startedAt,
        raw.endedAt,
        raw.durationMs,
        cost.totalCostUsd,
        cost.costSource,
        raw.sourceConfidence,
        raw.messages.length,
        toolCallCount,
        toolCallCount,
        sourcePath,
        JSON.stringify(dataQuality),
        raw.title ?? null,
        raw.gitOriginUrl ?? null,
        raw.gitBranch ?? null,
        raw.isAutomated ? 1 : 0,
        sessionPk,
      ],
    );
    db.run(`DELETE FROM usage_events WHERE session_fk = ?`, [sessionPk]);
    db.run(`DELETE FROM messages WHERE session_fk = ?`, [sessionPk]);
    db.run(`DELETE FROM session_model_usage WHERE session_fk = ?`, [sessionPk]);
    insertEvents(db, sessionPk, raw, redact);
    syncMessagesFts(db, sessionPk);
    persistToolEvents(db, sessionPk, raw.toolEvents ?? [], redact);
    persistFileEvents(db, sessionPk, raw.fileEvents ?? []);
    persistModelUsage(sessionPk, cost.modelUsage);
    return 'updated';
  }

  db.run(
    `INSERT INTO sessions (
      provider, cli, session_id, project_path, model, started_at, ended_at, duration_ms,
      total_cost_usd, cost_source, source_confidence, message_count, tool_call_count,
      raw_tool_call_count, source_path, data_quality_json,
      title, git_origin_url, git_branch, is_automated
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedProvider,
      raw.cli,
      raw.sessionId,
      normalizePath(raw.projectPath),
      normalizedModel,
      raw.startedAt,
      raw.endedAt,
      raw.durationMs,
      cost.totalCostUsd,
      cost.costSource,
      raw.sourceConfidence,
      raw.messages.length,
      toolCallCount,
      toolCallCount,
      sourcePath,
      JSON.stringify(dataQuality),
      raw.title ?? null,
      raw.gitOriginUrl ?? null,
      raw.gitBranch ?? null,
      raw.isAutomated ? 1 : 0,
    ],
  );

  const lastId = db.exec(`SELECT last_insert_rowid()`);
  sessionPk = Number(lastId[0].values[0][0]);
  insertEvents(db, sessionPk, raw, redact);
  syncMessagesFts(db, sessionPk);
  persistToolEvents(db, sessionPk, raw.toolEvents ?? [], redact);
  persistFileEvents(db, sessionPk, raw.fileEvents ?? []);
  persistModelUsage(sessionPk, cost.modelUsage);
  return 'new';
}

export function backfillEstimatedCosts(forceAll = false): void {
  const db = getDatabase();
  // Sync cost_source to match data_quality_json.cost for any sessions where they disagree.
  // data_quality_json.cost is the authoritative value set by each adapter at ingest time.
  db.run(
    `UPDATE sessions
     SET cost_source = json_extract(data_quality_json, '$.cost')
     WHERE data_quality_json IS NOT NULL
       AND json_extract(data_quality_json, '$.cost') IS NOT NULL
       AND cost_source != json_extract(data_quality_json, '$.cost')`,
  );

  // Only re-estimate sessions that still need it, unless a full rebuild is requested.
  const sessionFilter = forceAll
    ? ''
    : `WHERE total_cost_usd IS NULL OR total_cost_usd = 0 OR cost_source = 'unknown'`;
  const sessions = db.exec(
    `SELECT id, provider, cli, session_id, project_path, model, started_at, ended_at, duration_ms, source_confidence FROM sessions ${sessionFilter}`,
  );
  if (sessions.length === 0 || !sessions[0].values) return;

  initPricingCache();
  try {
    for (const row of sessions[0].values) {
      const id = Number(row[0]);
      const usageRows = db.exec(
        `SELECT timestamp, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, tool_calls_count FROM usage_events WHERE session_fk = ?`,
        [id],
      );
      const messageCount = Number(
        db.exec(`SELECT COUNT(*) FROM messages WHERE session_fk = ?`, [id])[0]?.values?.[0]?.[0] ??
          0,
      );
      const raw: RawSession = {
        sessionId: String(row[3]),
        provider: String(row[1]),
        cli: row[2] as RawSession['cli'],
        projectPath: row[4] as string | null,
        model: row[5] as string | null,
        startedAt: String(row[6]),
        endedAt: row[7] as string | null,
        durationMs: row[8] == null ? null : Number(row[8]),
        totalCostUsd: null,
        sourceConfidence: row[9] as RawSession['sourceConfidence'],
        messages: Array.from({ length: messageCount }, () => ({
          role: 'user',
          content: '',
          timestamp: String(row[6]),
        })),
        usageEvents: (usageRows[0]?.values ?? []).map((usage) => ({
          timestamp: String(usage[0]),
          inputTokens: Number(usage[1]) || 0,
          outputTokens: Number(usage[2]) || 0,
          cacheReadTokens: Number(usage[3]) || 0,
          cacheWriteTokens: Number(usage[4]) || 0,
          reasoningTokens: Number(usage[5]) || 0,
          toolCallsCount: Number(usage[6]) || 0,
        })),
      };
      const cost = resolveSessionCost(raw);
      if (cost.costSource === 'unknown') continue;
      db.run(
        `UPDATE sessions SET total_cost_usd = ?, cost_source = ? WHERE id = ? AND (total_cost_usd IS NULL OR total_cost_usd = 0 OR cost_source = 'unknown')`,
        [cost.totalCostUsd, cost.costSource, id],
      );
      persistModelUsage(id, cost.modelUsage);
    }
  } finally {
    clearPricingCache();
  }
}

function syncMessagesFts(db: ReturnType<typeof getDatabase>, sessionFk: number): void {
  try {
    db.run(`DELETE FROM messages_fts WHERE session_fk = ?`, [sessionFk]);
    db.run(
      `INSERT INTO messages_fts (content, session_fk)
       SELECT content, session_fk FROM messages
       WHERE session_fk = ? AND content IS NOT NULL AND content != ''`,
      [sessionFk],
    );
  } catch {
    // FTS sync is best-effort; failure doesn't break ingestion
  }
}

function insertEvents(
  db: ReturnType<typeof getDatabase>,
  sessionFk: number,
  raw: RawSession,
  redact: boolean,
): void {
  for (const msg of raw.messages) {
    const content = redact ? redactText(msg.content) : msg.content;
    db.run(`INSERT INTO messages (session_fk, role, content, timestamp) VALUES (?, ?, ?, ?)`, [
      sessionFk,
      msg.role,
      content.substring(0, 10000),
      msg.timestamp,
    ]);
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

function markAdapterSourcesDetected(cli: string, detected: boolean): void {
  const db = getDatabase();
  db.run(`UPDATE adapter_sources SET detected = ?, last_seen_at = ? WHERE cli = ?`, [
    detected ? 1 : 0,
    new Date().toISOString(),
    cli,
  ]);
}

function persistDiscoveredSources(cli: string, sessionPaths: string[]): void {
  for (const sessionPath of sessionPaths) {
    recordAdapterSource(cli, sessionPath, {
      detected: true,
      fileCount: 1,
      sourceType: inferSourceType(sessionPath),
      lastError: null,
    });
  }
}

function recordAdapterSource(
  cli: string,
  sessionPath: string,
  options: {
    detected: boolean;
    sourceType?: string;
    fileCount?: number;
    sessionCount?: number;
    lastError?: string | null;
    sessionsZeroTokens?: number;
    sessionsNoCost?: number;
    sessionsNoModel?: number;
  },
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO adapter_sources (
      cli, source_path, detected, source_type, last_seen_at, last_ingested_at, last_error, file_count, session_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cli, source_path) DO UPDATE SET
      detected = excluded.detected,
      source_type = COALESCE(excluded.source_type, adapter_sources.source_type),
      last_seen_at = excluded.last_seen_at,
      last_ingested_at = excluded.last_ingested_at,
      last_error = excluded.last_error,
      file_count = CASE
        WHEN excluded.file_count > 0 THEN excluded.file_count
        ELSE adapter_sources.file_count
      END,
      session_count = CASE
        WHEN excluded.session_count > 0 THEN excluded.session_count
        ELSE adapter_sources.session_count
      END`,
    [
      cli,
      sessionPath,
      options.detected ? 1 : 0,
      options.sourceType ?? inferSourceType(sessionPath),
      now,
      now,
      options.lastError ?? null,
      options.fileCount ?? 0,
      options.sessionCount ?? 0,
    ],
  );

  if (options.sessionsZeroTokens !== undefined) {
    db.run(
      `UPDATE adapter_sources SET sessions_zero_tokens = ?, sessions_no_cost = ?, sessions_no_model = ? WHERE cli = ? AND source_path = ?`,
      [
        options.sessionsZeroTokens,
        options.sessionsNoCost ?? 0,
        options.sessionsNoModel ?? 0,
        cli,
        sessionPath,
      ],
    );
  }
}

function inferSourceType(sessionPath: string): string {
  if (sessionPath.endsWith('.jsonl')) return 'jsonl';
  if (sessionPath.endsWith('.json')) return 'json';
  if (sessionPath.endsWith('.db') || sessionPath.endsWith('.sqlite')) return 'database';
  if (sessionPath.includes(':\\') || sessionPath.startsWith('/')) return 'file';
  return 'record';
}

function refreshProjects(): void {
  const db = getDatabase();

  // Upsert: preserve id and git_remote for existing projects; only recalculate stats.
  db.run(`
    INSERT INTO projects (path, total_sessions, total_cost)
    SELECT
      COALESCE(project_path, 'unknown'),
      COUNT(*),
      COALESCE(SUM(total_cost_usd), 0)
    FROM sessions
    GROUP BY COALESCE(project_path, 'unknown')
    ON CONFLICT(path) DO UPDATE SET
      total_sessions = excluded.total_sessions,
      total_cost = excluded.total_cost
  `);

  // Remove projects that no longer have any sessions.
  db.run(`
    DELETE FROM projects
    WHERE path NOT IN (
      SELECT DISTINCT COALESCE(project_path, 'unknown') FROM sessions
    )
  `);

  // Only query projects that don't have a cached remote yet — remotes rarely change.
  const projects = db.exec(
    `SELECT id, path FROM projects WHERE path != 'unknown' AND git_remote IS NULL`,
  );
  if (projects.length > 0 && projects[0].values) {
    for (const row of projects[0].values) {
      const id = Number(row[0]);
      const p = normalizePath(row[1] as string) ?? '';
      try {
        const result = execFileSync('git', ['-C', p, 'remote', 'get-url', 'origin'], {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
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
