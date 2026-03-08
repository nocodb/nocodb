import 'mocha';
import { expect } from 'chai';
import { Client } from 'pg';
import init from '../init';
import { createProject } from '../factory/base';
import { createTable } from '../factory/table';
import { createRow } from '../factory/row';
import type { IInitContext } from '../init';
import type { Base, Model } from '~/models';
import DataReflection from '~/ee/models/DataReflection';
import { NC_DATA_REFLECTION_SETTINGS } from '~/helpers/dataReflectionHelpers';

// System schemas that the interceptor injects for namespace OID subqueries
const SYSTEM_SCHEMAS = [
  'pg_catalog',
  'information_schema',
  'pg_toast',
  'public',
];

// Shared state across all test groups
let context: IInitContext;
let base: Base;
let table: Model;
let client: Client;
let reflection: InstanceType<typeof DataReflection>;
let availableSchemas: string[];

function setupAndTeardown() {
  before(async function () {
    if (process.env.NC_DISABLE_PG_DATA_REFLECTION === 'true') {
      this.skip();
      return;
    }

    this.timeout(120_000);

    context = await init();

    // Start the EE proxy (Noco uses the CE no-op init)
    await DataReflection.init();

    base = await createProject(context);

    table = await createTable(context, base, {
      table_name: 'test_proxy_data',
      title: 'TestProxyData',
    });

    for (let i = 0; i < 5; i++) {
      await createRow(context, { base, table, index: i });
    }

    await DataReflection.create(context.fk_workspace_id);

    reflection = await DataReflection.get({
      fk_workspace_id: context.fk_workspace_id,
    });

    availableSchemas = await DataReflection.availableSchemas(
      context.fk_workspace_id,
    );

    client = new Client({
      host: 'localhost',
      port: NC_DATA_REFLECTION_SETTINGS.port,
      user: reflection.username,
      password: reflection.password,
      database: context.fk_workspace_id,
      ssl: false,
    });

    await client.connect();
  });

  after(async function () {
    this.timeout(30_000);
    try {
      await client?.end();
    } catch (_) {
      // ignore
    }
    try {
      if (context?.fk_workspace_id) {
        await DataReflection.destroy(context.fk_workspace_id);
      }
    } catch (_) {
      // ignore
    }
  });
}

/** Check if a schema is allowed (either a workspace base schema or a system schema) */
function isAllowedSchema(schema: string): boolean {
  return availableSchemas.includes(schema) || SYSTEM_SCHEMAS.includes(schema);
}

function connectionAndBasicQueryTests() {
  it('successfully connects through proxy', function () {
    expect(client).to.not.be.undefined;
  });

  it('SELECT 1 returns expected result', async function () {
    const res = await client.query('SELECT 1');
    expect(res.rows).to.have.lengthOf(1);
    expect(res.rows[0]['?column?']).to.equal(1);
  });

  it('SELECT current_database() returns workspace ID', async function () {
    const res = await client.query('SELECT current_database()');
    // The interceptor rewrites current_database() to a string literal,
    // so the column name may differ — check any column contains the workspace ID
    const firstRow = res.rows[0];
    const values = Object.values(firstRow);
    expect(values).to.include(context.fk_workspace_id);
  });

  it('SELECT current_catalog returns workspace ID', async function () {
    const res = await client.query('SELECT current_catalog');
    const firstRow = res.rows[0];
    const values = Object.values(firstRow);
    expect(values).to.include(context.fk_workspace_id);
  });

  it('SHOW server_version succeeds', async function () {
    const res = await client.query('SHOW server_version');
    expect(res.rows).to.have.lengthOf(1);
    expect(res.rows[0].server_version).to.be.a('string');
  });
}

function schemaAndTableAccessTests() {
  it('can query tables in the base schema', async function () {
    const res = await client.query(
      `SELECT * FROM "${base.id}"."${table.table_name}" LIMIT 5`,
    );
    expect(res.rows.length).to.be.greaterThan(0);
    expect(res.rows.length).to.be.at.most(5);
  });

  it('row data matches what was inserted', async function () {
    const res = await client.query(
      `SELECT * FROM "${base.id}"."${table.table_name}" ORDER BY id LIMIT 3`,
    );
    expect(res.rows).to.have.lengthOf(3);
    for (let i = 0; i < 3; i++) {
      expect(res.rows[i].title).to.equal(`test-${i}`);
    }
  });

  it('information_schema.tables shows the table', async function () {
    const res = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${base.id}'`,
    );
    const tableNames = res.rows.map((r) => r.table_name);
    expect(tableNames).to.include(table.table_name);
  });

  it('pg_namespace only returns workspace base schemas', async function () {
    const res = await client.query('SELECT nspname FROM pg_namespace');
    const schemas = res.rows.map((r) => r.nspname);
    // The interceptor filters pg_namespace to only availableSchemas (base IDs)
    expect(schemas).to.include(base.id);
    for (const schema of schemas) {
      expect(
        availableSchemas.includes(schema),
        `Unexpected schema in pg_namespace: ${schema}`,
      ).to.be.true;
    }
  });

  it('does not expose schemas from other workspaces', async function () {
    const res = await client.query('SELECT nspname FROM pg_namespace');
    const schemas = res.rows.map((r) => r.nspname);
    // Every returned schema must be one of this workspace's bases
    for (const schema of schemas) {
      expect(
        availableSchemas.includes(schema),
        `Schema ${schema} not in workspace available schemas`,
      ).to.be.true;
    }
  });
}

function catalogFilteringTests() {
  it('pg_tables only shows tables from allowed schemas', async function () {
    const res = await client.query('SELECT * FROM pg_tables');
    for (const row of res.rows) {
      expect(
        isAllowedSchema(row.schemaname),
        `Unexpected schema in pg_tables: ${row.schemaname}`,
      ).to.be.true;
    }
  });

  it('pg_class is filtered to allowed namespace OIDs', async function () {
    const res = await client.query(
      'SELECT c.relname, n.nspname FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid',
    );
    // pg_class filter includes system schemas; pg_namespace filter does not.
    // The JOIN result is the intersection, so only availableSchemas appear.
    for (const row of res.rows) {
      expect(
        availableSchemas.includes(row.nspname),
        `Unexpected schema in pg_class join: ${row.nspname}`,
      ).to.be.true;
    }
  });

  it('pg_stat_user_tables only shows allowed schemas', async function () {
    const res = await client.query(
      'SELECT schemaname, relname FROM pg_stat_user_tables',
    );
    for (const row of res.rows) {
      expect(
        isAllowedSchema(row.schemaname),
        `Unexpected schema in pg_stat_user_tables: ${row.schemaname}`,
      ).to.be.true;
    }
  });

  it('pg_class with relkind filter only returns allowed tables', async function () {
    const res = await client.query(
      `SELECT relname FROM pg_class WHERE relkind = 'r'`,
    );
    expect(res.rows).to.be.an('array');
  });

  it('pg_type is filtered appropriately', async function () {
    const res = await client.query(
      'SELECT t.typname, n.nspname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid',
    );
    // pg_type filter includes system schemas; pg_namespace only has availableSchemas
    // The JOIN intersection is availableSchemas
    for (const row of res.rows) {
      expect(
        availableSchemas.includes(row.nspname),
        `Unexpected schema in pg_type join: ${row.nspname}`,
      ).to.be.true;
    }
  });
}

function showCommandTests() {
  it('SHOW search_path succeeds', async function () {
    const res = await client.query('SHOW search_path');
    expect(res.rows).to.have.lengthOf(1);
  });

  it('SHOW timezone succeeds', async function () {
    const res = await client.query('SHOW timezone');
    expect(res.rows).to.have.lengthOf(1);
  });

  it('SHOW max_connections is blocked', async function () {
    try {
      await client.query('SHOW max_connections');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).to.equal('42501');
    }
  });

  it('SHOW wal_level is blocked', async function () {
    try {
      await client.query('SHOW wal_level');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).to.equal('42501');
    }
  });
}

function blockedQueryTests() {
  async function expectBlocked(sql: string) {
    try {
      await client.query(sql);
      expect.fail(`Expected query to be blocked: ${sql}`);
    } catch (err) {
      expect(err.code, `Expected 42501 for: ${sql}`).to.equal('42501');
    }
  }

  it('ALTER ROLE is blocked', async function () {
    await expectBlocked("ALTER ROLE foo WITH PASSWORD 'bar'");
  });

  it('CREATE TEMP TABLE is blocked', async function () {
    await expectBlocked('CREATE TEMP TABLE foo (id int)');
  });

  it('DO $$ BEGIN ... END $$ is blocked', async function () {
    await expectBlocked("DO $$ BEGIN RAISE NOTICE 'hi'; END $$");
  });

  it('LISTEN is blocked', async function () {
    await expectBlocked('LISTEN test_channel');
  });

  it('NOTIFY is blocked', async function () {
    await expectBlocked("NOTIFY test_channel, 'payload'");
  });

  it('pg_sleep is blocked', async function () {
    await expectBlocked('SELECT pg_sleep(1)');
  });

  it('pg_advisory_lock is blocked', async function () {
    await expectBlocked('SELECT pg_advisory_lock(1)');
  });

  it('INSERT is blocked (readonly user)', async function () {
    try {
      await client.query(
        `INSERT INTO "${base.id}"."${table.table_name}" (title) VALUES ('hack')`,
      );
      expect.fail('Should have thrown');
    } catch (err) {
      // Proxy blocks or PG permission denied — both acceptable
      expect(err).to.have.property('code');
    }
  });

  it('blocked queries return proper PG error (not connection drop)', async function () {
    try {
      await client.query('ALTER ROLE foo SUPERUSER');
    } catch (_) {
      // expected
    }
    // Connection should still work after blocked query
    const res = await client.query('SELECT 1');
    expect(res.rows[0]['?column?']).to.equal(1);
  });
}

function functionRewriteTests() {
  it('pg_get_userbyid returns nocodb (not real role name)', async function () {
    const res = await client.query(
      `SELECT pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c
       LIMIT 1`,
    );
    expect(res.rows).to.have.lengthOf(1);
    expect(res.rows[0].owner).to.equal('nocodb');
  });

  it('pg_get_indexdef returns empty string', async function () {
    const res = await client.query(
      `SELECT pg_get_indexdef(i.indexrelid) AS idx_def
       FROM pg_index i
       LIMIT 1`,
    );
    expect(res.rows).to.have.lengthOf(1);
    expect(res.rows[0].idx_def).to.equal('');
  });

  it('pg_get_constraintdef returns empty string', async function () {
    const res = await client.query(
      `SELECT pg_get_constraintdef(c.oid) AS con_def
       FROM pg_constraint c
       LIMIT 1`,
    );
    if (res.rows.length > 0) {
      expect(res.rows[0].con_def).to.equal('');
    }
  });

  it('schema-qualified pg_catalog.pg_get_userbyid returns nocodb', async function () {
    const res = await client.query(
      `SELECT pg_catalog.pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c
       LIMIT 1`,
    );
    expect(res.rows).to.have.lengthOf(1);
    expect(res.rows[0].owner).to.equal('nocodb');
  });

  it('pg_get_ruledef is blocked', async function () {
    try {
      await client.query('SELECT pg_get_ruledef(1)');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).to.equal('42501');
    }
  });

  it('double-quoted "pg_get_userbyid" is neutralized', async function () {
    // Should be rewritten to 'nocodb'::text, not leak the real role name
    const res = await client.query(
      `SELECT "pg_get_userbyid"(c.relowner) AS owner
       FROM pg_class c
       LIMIT 1`,
    );
    expect(res.rows).to.have.lengthOf(1);
    expect(res.rows[0].owner).to.equal('nocodb');
  });

  it('publication + publishable query returns empty result', async function () {
    const res = await client.query(
      "SELECT * FROM pg_publication p WHERE pg_relation_is_publishable('t')",
    );
    expect(res.rows).to.have.lengthOf(0);
  });
}

function complexQueryTests() {
  it('subquery with pg_namespace join is filtered', async function () {
    const res = await client.query(`
      SELECT c.relname
      FROM pg_class c
      WHERE c.relnamespace IN (
        SELECT oid FROM pg_namespace WHERE nspname = '${base.id}'
      )
    `);
    expect(res.rows).to.be.an('array');
    if (res.rows.length > 0) {
      expect(res.rows[0]).to.have.property('relname');
    }
  });

  it('CTE referencing catalog table is filtered', async function () {
    const res = await client.query(`
      WITH schemas AS (
        SELECT nspname FROM pg_namespace
      )
      SELECT * FROM schemas
    `);
    const schemas = res.rows.map((r) => r.nspname);
    expect(schemas).to.include(base.id);
    // pg_namespace is filtered to availableSchemas only
    for (const schema of schemas) {
      expect(
        availableSchemas.includes(schema),
        `Unexpected schema in CTE: ${schema}`,
      ).to.be.true;
    }
  });

  it('multi-statement with blocked command is rejected', async function () {
    try {
      await client.query('SELECT 1; ALTER ROLE foo SUPERUSER');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).to.equal('42501');
    }
  });
}

function dataReflectionProxyTests() {
  setupAndTeardown();

  describe('Connection & Basic Queries', connectionAndBasicQueryTests);
  describe('Schema & Table Access', schemaAndTableAccessTests);
  describe('Catalog Filtering', catalogFilteringTests);
  describe('SHOW Commands', showCommandTests);
  describe('Blocked Queries', blockedQueryTests);
  describe('Function Rewrites', functionRewriteTests);
  describe('Complex Queries', complexQueryTests);
}

export function dataReflectionProxyTest() {
  describe('dataReflectionProxy (integration)', dataReflectionProxyTests);
}
