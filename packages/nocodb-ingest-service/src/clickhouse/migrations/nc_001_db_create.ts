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
}

async function down(client: ClickHouse): Promise<void> {}

export { up, down };
