CREATE TABLE IF NOT EXISTS page_snapshot (
  id String(20) NOT NULL,
  fk_workspace_id String(20) NOT NULL,
  fk_project_id String(20) NOT NULL,
  fk_page_id String(20) NOT NULL,
  last_updated_by_id String(20) NOT NULL,
  created_at DateTime DEFAULT now(),
  last_page_updated_time DateTime,
  before_page_json String,
  after_page_json String,
  diff String,
  type String NOT NULL,
) ENGINE = ReplacingMergeTree
  ORDER BY id;
