CREATE TABLE IF NOT EXISTS docs_page_snapshot (
  id String(20) NOT NULL,
  fk_workspace_id String(20) NOT NULL,
  fk_project_id String(20) NOT NULL,
  fk_page_id String(20) NOT NULL,
  last_updated_by_id String(20) NOT NULL,
  created_at DateTime DEFAULT now(),
  page_json String,
  diff String,
  type String(20) NOT NULL,
) ENGINE = ReplacingMergeTree
  ORDER BY id;
