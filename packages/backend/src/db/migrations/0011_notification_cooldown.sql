ALTER TABLE notification_destinations ADD COLUMN min_interval_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notification_destinations ADD COLUMN last_notified_at TEXT;
