CREATE TABLE IF NOT EXISTS api_count (
  id UUID,
  fk_workspace_id String(20) NOT NULL,
  api_token String(150) NOT NULL,
  count UInt64 NOT NULL DEFAULT 0,
  exec_time UInt64 NOT NULL DEFAULT 0,
  ttl UInt64 NOT NULL DEFAULT 0,
  max_apis UInt64 NOT NULL DEFAULT 0,
  created_at DateTime,
  PRIMARY KEY (id)
) ENGINE = MergeTree;
