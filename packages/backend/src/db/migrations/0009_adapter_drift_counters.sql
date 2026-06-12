ALTER TABLE adapter_sources ADD COLUMN sessions_zero_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE adapter_sources ADD COLUMN sessions_no_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE adapter_sources ADD COLUMN sessions_no_model INTEGER NOT NULL DEFAULT 0;
