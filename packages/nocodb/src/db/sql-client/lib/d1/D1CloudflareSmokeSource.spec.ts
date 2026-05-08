import knex from 'knex';
import D1KnexClient from './D1KnexClient';

const smokeEnv = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
};

const describeSmoke = Object.values(smokeEnv).every(Boolean)
  ? describe
  : describe.skip;

describeSmoke('Cloudflare D1 smoke', () => {
  jest.setTimeout(120000);

  const tableName = 'nocodb_d1_smoke_tasks';
  const ownerTableName = 'nocodb_d1_smoke_owners';
  const viewName = 'nocodb_d1_smoke_task_view';
  const indexName = 'idx_nocodb_d1_smoke_tasks_title';

  let db: any;

  beforeAll(async () => {
    db = knex({
      client: D1KnexClient,
      connection: {
        accountId: smokeEnv.accountId,
        databaseId: smokeEnv.databaseId,
        apiToken: smokeEnv.apiToken,
      },
      useNullAsDefault: true,
    } as any);

    await db.raw(`DROP VIEW IF EXISTS ??`, [viewName]);
    await db.raw(`DROP TABLE IF EXISTS ??`, [tableName]);
    await db.raw(`DROP TABLE IF EXISTS ??`, [ownerTableName]);
    await db.raw(
      `CREATE TABLE ?? (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )`,
      [ownerTableName],
    );
    await db.raw(
      `CREATE TABLE ?? (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done INTEGER DEFAULT 0,
        owner_id INTEGER,
        created_at TEXT,
        FOREIGN KEY(owner_id) REFERENCES ??(id) ON DELETE CASCADE
      )`,
      [tableName, ownerTableName],
    );
    await db.raw(`CREATE UNIQUE INDEX ?? ON ??(title)`, [
      indexName,
      tableName,
    ]);
    await db.raw(`CREATE VIEW ?? AS SELECT id, title, done FROM ??`, [
      viewName,
      tableName,
    ]);
  });

  afterAll(async () => {
    if (!db) return;

    await db.raw(`DROP VIEW IF EXISTS ??`, [viewName]);
    await db.raw(`DROP TABLE IF EXISTS ??`, [tableName]);
    await db.raw(`DROP TABLE IF EXISTS ??`, [ownerTableName]);
    await db.destroy();
  });

  it('connects, mutates rows, and normalizes Knex responses', async () => {
    await expect(db.raw('SELECT 1+1 AS data')).resolves.toEqual([{ data: 2 }]);

    const [ownerId] = await db(ownerTableName).insert({ name: 'Ada' });
    const [taskId] = await db(tableName).insert({
      title: 'ship d1',
      done: 0,
      owner_id: ownerId,
      created_at: '2026-05-08T00:00:00.000Z',
    });

    await expect(db(tableName).first('id', 'title', 'done')).resolves.toEqual({
      id: taskId,
      title: 'ship d1',
      done: 0,
    });
    await expect(
      db(tableName).where({ id: taskId }).update({ done: 1 }),
    ).resolves.toBe(1);
    await expect(db(tableName).pluck('title')).resolves.toEqual(['ship d1']);
    await expect(db(tableName).where({ id: taskId }).delete()).resolves.toBe(1);
  });

  it('reuses SQLite-compatible introspection against real D1', async () => {
    const tables = await db.raw(
      `SELECT name as tn FROM sqlite_master where type = 'table'`,
    );
    expect(tables).toEqual(
      expect.arrayContaining([expect.objectContaining({ tn: tableName })]),
    );

    const columns = await db.raw(`PRAGMA table_info(??)`, [tableName]);
    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', pk: 1 }),
        expect.objectContaining({ name: 'title', type: 'TEXT' }),
        expect.objectContaining({ name: 'owner_id', type: 'INTEGER' }),
      ]),
    );

    const indexes = await db.raw(`PRAGMA index_list(??)`, [tableName]);
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: indexName, unique: 1 }),
      ]),
    );
    const indexColumns = await db.raw(`PRAGMA index_info(??)`, [indexName]);
    expect(indexColumns).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'title' })]),
    );

    const relations = await db.raw(`PRAGMA foreign_key_list(??)`, [tableName]);
    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'owner_id',
          table: ownerTableName,
          to: 'id',
          on_delete: 'CASCADE',
        }),
      ]),
    );

    const views = await db.raw(`SELECT * FROM sqlite_master WHERE type = 'view'`);
    expect(views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: viewName }),
      ]),
    );
  });
});
