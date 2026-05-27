ALTER TABLE sessions ADD COLUMN cost_source TEXT NOT NULL DEFAULT 'unknown' CHECK(cost_source IN ('actual', 'estimated', 'unknown'));

CREATE TABLE IF NOT EXISTS hidden_projects (
  path TEXT PRIMARY KEY,
  hidden_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hidden_projects_path ON hidden_projects(path);
