PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS sessions_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  cli TEXT NOT NULL CHECK(cli IN ('claude', 'opencode', 'codex', 'gemini', 'kimi', 'aider', 'qwen', 'antigravity')),
  session_id TEXT NOT NULL,
  project_path TEXT,
  model TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER,
  total_cost_usd REAL,
  source_confidence TEXT NOT NULL DEFAULT 'LOW' CHECK(source_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  message_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, cli, provider)
);

INSERT OR IGNORE INTO sessions_next (
  id, provider, cli, session_id, project_path, model, started_at, ended_at,
  duration_ms, total_cost_usd, source_confidence, message_count, tool_call_count, created_at
)
SELECT
  id, provider, cli, session_id, project_path, model, started_at, ended_at,
  duration_ms, total_cost_usd, source_confidence, message_count, tool_call_count, created_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_next RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_cli ON sessions(cli);
CREATE INDEX IF NOT EXISTS idx_sessions_project_path ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_sessions_model ON sessions(model);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

PRAGMA foreign_keys=on;
