import knex from 'knex';
import D1KnexClient from './D1KnexClient';

const createResponse = (
  body: any,
  init: { ok?: boolean; status?: number } = {},
) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.ok === false ? 'Bad Request' : 'OK',
    json: async () => body,
  } as any);

const createD1Knex = (fetch = jest.fn()) =>
  knex({
    client: D1KnexClient,
    connection: {
      accountId: 'account-id',
      databaseId: 'database-id',
      apiToken: 'api-token',
      fetch,
    },
    useNullAsDefault: true,
  } as any);

describe('D1KnexClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends SQL and bindings to the Cloudflare D1 query endpoint', async () => {
    const fetch = jest.fn().mockResolvedValue(
      createResponse({
        success: true,
        result: [{ success: true, results: [{ data: 2 }], meta: {} }],
      }),
    );
    const db = createD1Knex(fetch);

    await expect(db.raw('SELECT 1+1 AS data')).resolves.toEqual([{ data: 2 }]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-id/d1/database/database-id/query',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer api-token',
        }),
        body: JSON.stringify({ sql: 'SELECT 1+1 AS data', params: [] }),
      }),
    );

    await db.destroy();
  });

  it('normalizes first, pluck, insert, update, and delete responses', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          success: true,
          result: [
            { success: true, results: [{ id: 1, title: 'A' }], meta: {} },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          success: true,
          result: [
            {
              success: true,
              results: [{ title: 'A' }, { title: 'B' }],
              meta: {},
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          success: true,
          result: [{ success: true, results: [], meta: { last_row_id: 42 } }],
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          success: true,
          result: [{ success: true, results: [], meta: { changes: 3 } }],
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          success: true,
          result: [{ success: true, results: [], meta: { changes: 2 } }],
        }),
      );
    const db = createD1Knex(fetch);

    await expect(db('tasks').first()).resolves.toEqual({ id: 1, title: 'A' });
    await expect(db('tasks').pluck('title')).resolves.toEqual(['A', 'B']);
    await expect(db('tasks').insert({ title: 'C' })).resolves.toEqual([42]);
    await expect(db('tasks').update({ title: 'D' })).resolves.toBe(3);
    await expect(db('tasks').delete()).resolves.toBe(2);

    await db.destroy();
  });

  it('throws useful validation and Cloudflare API errors', async () => {
    const missingCredentials = knex({
      client: D1KnexClient,
      connection: { accountId: 'account-id' },
      useNullAsDefault: true,
    } as any);

    await expect(missingCredentials.raw('SELECT 1')).rejects.toThrow(
      'Missing required Cloudflare D1 database ID',
    );
    await missingCredentials.destroy();

    const fetch = jest.fn().mockResolvedValue(
      createResponse(
        {
          success: false,
          errors: [{ message: 'Authentication error', code: 10000 }],
        },
        { ok: false, status: 400 },
      ),
    );
    const db = createD1Knex(fetch);

    await expect(db.raw('SELECT 1')).rejects.toThrow(
      'Cloudflare D1 request failed (400 Bad Request): Authentication error (10000)',
    );
    await db.destroy();
  });

  it('accepts normalized Cloudflare REST credential fields', async () => {
    const fetch = jest.fn().mockResolvedValue(
      createResponse({
        success: true,
        result: [{ success: true, results: [{ ok: 1 }], meta: {} }],
      }),
    );
    const db = knex({
      client: D1KnexClient,
      connection: {
        account_id: 'normalized-account',
        database_id: 'normalized-database',
        key: 'normalized-token',
        fetch,
      },
      useNullAsDefault: true,
    } as any);

    await expect(db.raw('SELECT 1 AS ok')).resolves.toEqual([{ ok: 1 }]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/normalized-account/d1/database/normalized-database/query',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer normalized-token',
        }),
      }),
    );

    await db.destroy();
  });

  it('surfaces invalid JSON and statement-level D1 errors', async () => {
    const invalidJsonDb = createD1Knex(
      jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new Error('invalid json');
        },
      }),
    );

    await expect(invalidJsonDb.raw('SELECT 1')).rejects.toThrow(
      'Cloudflare D1 returned an invalid JSON response (200 OK)',
    );
    await invalidJsonDb.destroy();

    const statementErrorDb = createD1Knex(
      jest.fn().mockResolvedValue(
        createResponse({
          success: true,
          result: [
            {
              success: false,
              errors: [{ message: 'no such table: missing' }],
              meta: {},
            },
          ],
        }),
      ),
    );

    await expect(statementErrorDb.raw('SELECT * FROM missing')).rejects.toThrow(
      'Cloudflare D1 statement 1 failed: no such table: missing',
    );
    await statementErrorDb.destroy();
  });

  it('sends precompiled multi-statement work as an atomic D1 batch', async () => {
    const fetch = jest.fn().mockResolvedValue(
      createResponse({
        success: true,
        result: [
          { success: true, results: [], meta: { changes: 1 } },
          { success: true, results: [{ total: 1 }], meta: {} },
        ],
      }),
    );
    const db = createD1Knex(fetch);

    await expect(
      (db.client as D1KnexClient).batch([
        {
          sql: 'INSERT INTO tasks (title) VALUES (?)',
          params: ['ship d1'],
          method: 'insert',
        },
        { sql: 'SELECT COUNT(*) as total FROM tasks' },
      ]),
    ).resolves.toEqual([[1], [{ total: 1 }]]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-id/d1/database/database-id/query',
      expect.objectContaining({
        body: JSON.stringify({
          batch: [
            {
              sql: 'INSERT INTO tasks (title) VALUES (?)',
              params: ['ship d1'],
            },
            { sql: 'SELECT COUNT(*) as total FROM tasks', params: [] },
          ],
        }),
      }),
    );

    await db.destroy();
  });

  it('reports the failing statement from a D1 batch rollback', async () => {
    const db = createD1Knex(
      jest.fn().mockResolvedValue(
        createResponse({
          success: true,
          result: [
            { success: true, results: [], meta: { changes: 1 } },
            {
              success: false,
              errors: [{ message: 'UNIQUE constraint failed: tasks.title' }],
              meta: {},
            },
          ],
        }),
      ),
    );

    await expect(
      (db.client as D1KnexClient).batch([
        { sql: 'INSERT INTO tasks (title) VALUES (?)', params: ['ship d1'] },
        { sql: 'INSERT INTO tasks (title) VALUES (?)', params: ['ship d1'] },
      ]),
    ).rejects.toThrow(
      'Cloudflare D1 statement 2 failed: UNIQUE constraint failed: tasks.title',
    );

    await db.destroy();
  });

  it('no-ops interactive transaction statements with one process warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = jest.fn();
    const db = createD1Knex(fetch);

    await expect(db.raw('BEGIN')).resolves.toEqual([]);
    await expect(db.raw('COMMIT')).resolves.toEqual([]);
    await expect(db.raw('ROLLBACK')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Cloudflare D1 does not support interactive transactions over the HTTP API. Use D1 batch for precompiled atomic multi-statement writes; interactive transaction blocks are best-effort.',
    );

    await db.destroy();
  });

  it('preflights D1 query limits', async () => {
    const db = createD1Knex(jest.fn());

    await expect(
      db.raw(
        `SELECT ${Array.from({ length: 101 }, () => '?').join(', ')}`,
        Array.from({ length: 101 }, (_, i) => i),
      ),
    ).rejects.toThrow('at most 100 bound parameters');

    await expect(db.raw(`SELECT '${'x'.repeat(100 * 1024)}'`)).rejects.toThrow(
      'SQL statements up to 100 KB',
    );

    await db.destroy();
  });

  it('skips Cloudflare internal foreign key introspection locally', async () => {
    const fetch = jest.fn();
    const db = createD1Knex(fetch);

    await expect(
      db.raw('PRAGMA foreign_key_list(`_cf_KV`)'),
    ).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    await db.destroy();
  });

  it('executes SQLite introspection SQL over the D1 REST transport', async () => {
    const fetch = jest.fn().mockImplementation(async (_url, init) => {
      const { sql } = JSON.parse(init.body);
      let results = [];

      if (sql.includes("type = 'table'")) {
        results = [{ tn: 'tasks' }, { tn: 'sqlite_sequence' }];
      } else if (sql.includes('PRAGMA table_info')) {
        results = [
          {
            cid: 0,
            name: 'id',
            type: 'INTEGER',
            notnull: 1,
            dflt_value: null,
            pk: 1,
          },
          {
            cid: 1,
            name: 'title',
            type: 'TEXT',
            notnull: 0,
            dflt_value: null,
            pk: 0,
          },
        ];
      } else if (sql.includes("type = 'trigger'")) {
        results = [];
      } else if (sql.includes('PRAGMA index_list')) {
        results = [{ name: 'idx_tasks_title', unique: 1 }];
      } else if (sql.includes('PRAGMA index_info')) {
        results = [{ name: 'title' }];
      } else if (sql.includes('PRAGMA foreign_key_list')) {
        results = [
          {
            from: 'owner_id',
            table: 'users',
            to: 'id',
            on_update: 'NO ACTION',
            on_delete: 'CASCADE',
            match: 'NONE',
          },
        ];
      } else if (sql.includes("type = 'view'")) {
        results = [
          {
            name: 'task_view',
            sql: 'CREATE VIEW task_view AS SELECT * FROM tasks',
          },
        ];
      }

      return createResponse({
        success: true,
        result: [{ success: true, results, meta: {} }],
      });
    });

    const db = createD1Knex(fetch);

    await expect(
      db.raw(`SELECT name as tn FROM sqlite_master where type = 'table'`),
    ).resolves.toEqual([{ tn: 'tasks' }, { tn: 'sqlite_sequence' }]);
    await expect(db.raw(`PRAGMA table_info(??)`, ['tasks'])).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', type: 'INTEGER', pk: 1 }),
        expect.objectContaining({ name: 'title', type: 'TEXT', pk: 0 }),
      ]),
    );
    await expect(db.raw(`PRAGMA index_list(??)`, ['tasks'])).resolves.toEqual([
      { name: 'idx_tasks_title', unique: 1 },
    ]);
    await expect(
      db.raw(`PRAGMA foreign_key_list(??)`, ['tasks']),
    ).resolves.toEqual([
      expect.objectContaining({
        from: 'owner_id',
        table: 'users',
        to: 'id',
        on_delete: 'CASCADE',
      }),
    ]);
    await expect(
      db.raw(`SELECT * FROM sqlite_master WHERE type = 'view'`),
    ).resolves.toEqual([
      {
        name: 'task_view',
        sql: 'CREATE VIEW task_view AS SELECT * FROM tasks',
      },
    ]);

    await db.destroy();
  });
});
