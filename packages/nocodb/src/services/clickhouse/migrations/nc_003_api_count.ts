import type { ClickHouse } from 'clickhouse';

async function up(
  client: ClickHouse,
  config: { database?: string },
): Promise<void> {
  await client
    .query(
      `
CREATE TABLE ${config.database}.api_count (
  fk_workspace_id String(20) NOT NULL,
  api_token String(150) NOT NULL,
  count UInt64 NOT NULL DEFAULT 0,  
) ENGINE = ReplacingMergeTree
  ORDER BY api_token;
    `,
    )
    .toPromise();
}

async function down(client: ClickHouse): Promise<void> {}

export { up, down };
