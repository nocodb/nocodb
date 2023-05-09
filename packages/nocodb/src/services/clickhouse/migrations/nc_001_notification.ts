import type { ClickHouse } from 'clickhouse';

async function up(
  client: ClickHouse,
  config: { database?: string },
): Promise<void> {
  await client
    .query(
      `
CREATE DATABASE IF NOT EXISTS ${config.database ?? 'nc'};
    `,
    )
    .toPromise();

  await client
    .query(
      `
      CREATE TABLE IF NOT EXISTS ${config.database}.notification (
          id String(20) NOT NULL,
          body Text,
          type String,
          is_read UInt8 DEFAULT 0,
          is_deleted UInt8 DEFAULT 0,
          fk_user_id String(20),
          created_at DateTime DEFAULT now(),
          PRIMARY KEY (id)
      ) ENGINE = ReplacingMergeTree
      ORDER BY id;
    `,
    )
    .toPromise();
}

async function down(client: ClickHouse): Promise<void> {}

export { up, down };
