CREATE TABLE IF NOT EXISTS notification_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('discord', 'slack', 'custom')),
  webhook_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id INTEGER NOT NULL REFERENCES notification_destinations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN ('ingestion_complete', 'budget_warning', 'budget_approaching', 'budget_exceeded')),
  enabled INTEGER NOT NULL DEFAULT 1,
  UNIQUE(destination_id, event_type)
);
