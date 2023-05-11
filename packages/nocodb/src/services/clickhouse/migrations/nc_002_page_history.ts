import type { ClickHouse } from 'clickhouse';

async function up(
  client: ClickHouse,
  config: { database?: string },
): Promise<void> {
  await client
    .query(
      `
CREATE TABLE IF NOT EXISTS ${config.database}.page_history (
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
    `,
    )
    .toPromise();
}

async function down(client: ClickHouse): Promise<void> {}

export { up, down };
