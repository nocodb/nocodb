import type { ClickHouse } from 'clickhouse';

async function up(client: ClickHouse): Promise<void> {
  await client.query(`
CREATE DATABASE IF NOT EXISTS database;
    `).toPromise();

  await client.query(`
      CREATE TABLE IF NOT EXISTS database.notification (
          id String(20) NOT NULL,
          body Text,
          type String,
          is_read UInt8 DEFAULT 0,
          is_deleted UInt8 DEFAULT 0,
          fk_user_id String(20),
          created_at DateTime DEFAULT now(),
          updated_at DateTime DEFAULT now(),
          PRIMARY KEY (id)
      ) ENGINE = ReplacingMergeTree
      ORDER BY id;
    `).toPromise();
}

async function down(client: ClickHouse): Promise<void> {
  await client.query(`
      DROP TABLE IF EXISTS my_table
    `).toPromise();
}

export { up, down };
