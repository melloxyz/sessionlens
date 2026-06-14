CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  session_fk UNINDEXED
);
