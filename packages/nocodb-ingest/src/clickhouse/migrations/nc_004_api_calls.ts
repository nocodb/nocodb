import type { ClickHouse } from 'clickhouse';

async function up(
  client: ClickHouse,
  config: { database?: string },
): Promise<void> {
  await client
    .query(
      `
CREATE TABLE IF NOT EXISTS  ${config.database}.api_calls (
    timestamp DateTime,
    workspace_id String,
  	user_id String,
    project_id String,
    url String,
    method String,
    status UInt16,
    exec_time UInt64,
  ) ENGINE = MergeTree
  ORDER BY timestamp
  ;
    `,
    )
    .toPromise();
}

async function down(client: ClickHouse): Promise<void> {}

export { up, down };
