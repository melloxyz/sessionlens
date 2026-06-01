ALTER TABLE sessions ADD COLUMN source_path TEXT;
ALTER TABLE sessions ADD COLUMN data_quality_json TEXT;
ALTER TABLE sessions ADD COLUMN raw_tool_call_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS session_tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_json TEXT,
  output_preview TEXT,
  source_confidence TEXT NOT NULL DEFAULT 'medium' CHECK(source_confidence IN ('high', 'medium', 'low'))
);

CREATE TABLE IF NOT EXISTS session_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_fk INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path TEXT,
  operation TEXT NOT NULL CHECK(operation IN ('read', 'write', 'edit', 'delete', 'shell_possible', 'unknown')),
  tool_name TEXT,
  timestamp TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK(confidence IN ('high', 'medium', 'low')),
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS adapter_sources (
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
);

CREATE INDEX IF NOT EXISTS idx_sessions_raw_tool_call_count ON sessions(raw_tool_call_count);
CREATE INDEX IF NOT EXISTS idx_sessions_source_path ON sessions(source_path);
CREATE INDEX IF NOT EXISTS idx_session_tools_session ON session_tools(session_fk);
CREATE INDEX IF NOT EXISTS idx_session_files_session ON session_files(session_fk);
CREATE INDEX IF NOT EXISTS idx_adapter_sources_cli ON adapter_sources(cli);
