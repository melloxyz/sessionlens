-- Add session metadata fields captured from CLI sources
ALTER TABLE sessions ADD COLUMN title TEXT;
ALTER TABLE sessions ADD COLUMN git_origin_url TEXT;
ALTER TABLE sessions ADD COLUMN git_branch TEXT;
ALTER TABLE sessions ADD COLUMN is_automated INTEGER NOT NULL DEFAULT 0;
