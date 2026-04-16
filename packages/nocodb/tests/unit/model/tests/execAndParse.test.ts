import 'mocha';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { generateDefaultRowAttributes } from '../../factory/row';
import { isSqlite } from '../../init/db';
import type { Knex } from 'knex';
import type View from '~/models/View';
import type Base from '~/models/Base';
import type Model from '~/models/Model';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import CustomKnex from '~/db/CustomKnex';
import Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const MYSQL_TEST_DB = 'test_exec_rows';
const MYSQL_TEST_TABLE = 'exec_test';

function mysqlConnectionConfig() {
  return {
    client: 'mysql2',
    connection: {
      host: process.env.NC_TEST_MYSQL_HOST || 'localhost',
      port: Number(process.env.NC_TEST_MYSQL_PORT) || 3306,
      user: process.env.NC_TEST_MYSQL_USER || 'root',
      password: process.env.NC_TEST_MYSQL_PASSWORD || 'password',
    },
  };
}

function execAndParseTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;
  let table: Model;
  let view: View;
  let baseModelSql: BaseModelSqlv2;
  let source: Source;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    table = await createTable(context, base);
    view = await table.getViews(ctx)[0];

    source = await Source.get(ctx, table.source_id);
    baseModelSql = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(source),
      model: table,
      view,
      context: ctx,
      schema: source.getConfig()?.schema,
    });
  });

  describe('execAndGetRows', () => {
    it('returns an array for SELECT queries', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      await baseModelSql.insert(
        generateDefaultRowAttributes({ columns }),
        request,
      );

      const selectQuery = baseModelSql
        .dbDriver(baseModelSql.tnPath)
        .select('*')
        .toQuery();
      const result = await baseModelSql.execAndGetRows(selectQuery);

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0]).to.have.property('title');
    });

    it('returns an empty array for SELECT on empty table', async () => {
      const selectQuery = baseModelSql
        .dbDriver(baseModelSql.tnPath)
        .select('*')
        .toQuery();
      const result = await baseModelSql.execAndGetRows(selectQuery);

      expect(result).to.be.an('array');
      expect(result).to.have.length(0);
    });

    it('returns an array for INSERT queries', async () => {
      if (isSqlite(context)) return;

      const insertQuery = baseModelSql
        .dbDriver(baseModelSql.tnPath)
        .insert({ title: 'exec-test' })
        .toQuery();
      const result = await baseModelSql.execAndGetRows(insertQuery);

      expect(result).to.be.an('array');
    });

    it('returns an array when run inside a transaction', async () => {
      if (isSqlite(context)) return;

      const dbDriver = await NcConnectionMgrv2.get(source);
      const trx = await dbDriver.transaction();

      try {
        const selectQuery = baseModelSql
          .dbDriver(baseModelSql.tnPath)
          .select('*')
          .toQuery();
        const result = await baseModelSql.execAndGetRows(selectQuery, trx);

        expect(result).to.be.an('array');
        await trx.commit();
      } catch (e) {
        await trx.rollback();
        throw e;
      }
    });

    it('result is spreadable into another array', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      const bulkData = Array(3)
        .fill(0)
        .map((_, index) => generateDefaultRowAttributes({ columns, index }));
      await baseModelSql.bulkInsert(bulkData, { cookie: request });

      const selectQuery = baseModelSql
        .dbDriver(baseModelSql.tnPath)
        .select('*')
        .toQuery();
      const result = await baseModelSql.execAndGetRows(selectQuery);

      // Core assertion: spread must work without throwing
      const collected: any[] = [];
      collected.push(...result);

      expect(collected).to.have.length(3);
      expect(collected).to.deep.equal(result);
    });

    it('handles multiple sequential queries with consistent return types', async () => {
      if (isSqlite(context)) return;

      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      await baseModelSql.insert(
        generateDefaultRowAttributes({ columns }),
        request,
      );

      const dbDriver = await NcConnectionMgrv2.get(source);
      const trx = await dbDriver.transaction();

      try {
        const insertQuery = baseModelSql
          .dbDriver(baseModelSql.tnPath)
          .insert({ title: 'trx-test' })
          .toQuery();
        const selectQuery = baseModelSql
          .dbDriver(baseModelSql.tnPath)
          .select('*')
          .toQuery();

        const insertResult = await baseModelSql.execAndGetRows(
          insertQuery,
          trx,
        );
        const selectResult = await baseModelSql.execAndGetRows(
          selectQuery,
          trx,
        );

        expect(insertResult).to.be.an('array');
        expect(selectResult).to.be.an('array');
        expect(selectResult).to.have.length(2);

        // Both should be spreadable
        const all: any[] = [];
        all.push(...insertResult);
        all.push(...selectResult);

        expect(all.length).to.equal(insertResult.length + selectResult.length);

        await trx.commit();
      } catch (e) {
        await trx.rollback();
        throw e;
      }
    });
  });

  describe('execAndGetRows - MySQL external source', () => {
    let mysqlAvailable = false;
    let mysqlKnex: Knex;
    let mysqlBaseModel: BaseModelSqlv2;

    before(async function () {
      try {
        const adminKnex = CustomKnex(mysqlConnectionConfig());
        await adminKnex.raw('SELECT 1');
        await adminKnex.raw(`DROP DATABASE IF EXISTS \`${MYSQL_TEST_DB}\``);
        await adminKnex.raw(`CREATE DATABASE \`${MYSQL_TEST_DB}\``);
        await adminKnex.destroy();

        const cfg = mysqlConnectionConfig();
        (cfg.connection as any).database = MYSQL_TEST_DB;
        mysqlKnex = CustomKnex(cfg);

        await mysqlKnex.schema.createTable(MYSQL_TEST_TABLE, (t) => {
          t.increments('id').primary();
          t.string('title');
        });

        mysqlAvailable = true;
      } catch {
        // MySQL not available — tests will be skipped
      }
    });

    beforeEach(async function () {
      if (!mysqlAvailable) return this.skip();

      // Truncate between tests
      await mysqlKnex(MYSQL_TEST_TABLE).truncate();

      // Build a BaseModelSqlv2 backed by the MySQL driver.
      // We reuse the PG-based table metadata (model, view, context) since
      // execAndGetRows only needs dbDriver + clientType to branch correctly.
      mysqlBaseModel = new BaseModelSqlv2({
        dbDriver: mysqlKnex as any,
        model: table,
        view,
        context: ctx,
        schema: undefined,
      });
    });

    after(async function () {
      if (mysqlKnex) {
        await mysqlKnex.destroy();
      }
    });

    it('isMySQL is true for the MySQL-backed model', async () => {
      expect(mysqlBaseModel.isMySQL).to.be.true;
    });

    it('INSERT returns [{ insertId }] not a raw number', async () => {
      const insertQuery = `INSERT INTO \`${MYSQL_TEST_TABLE}\` (\`title\`) VALUES ('mysql-test')`;
      const result = await mysqlBaseModel.execAndGetRows(insertQuery);

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0]).to.have.property('insertId');
      expect(result[0].insertId).to.be.a('number');
      expect(result[0].insertId).to.be.greaterThan(0);
    });

    it('INSERT result is spreadable', async () => {
      const insertQuery = `INSERT INTO \`${MYSQL_TEST_TABLE}\` (\`title\`) VALUES ('spread-test')`;
      const result = await mysqlBaseModel.execAndGetRows(insertQuery);

      const collected: any[] = [];
      collected.push(...result);

      expect(collected).to.have.length(1);
      expect(collected[0]).to.deep.equal(result[0]);
    });

    it('multiple INSERTs produce consistent array results', async () => {
      const trx = await mysqlKnex.transaction();

      try {
        const responses: any[] = [];
        for (let i = 0; i < 3; i++) {
          const q = `INSERT INTO \`${MYSQL_TEST_TABLE}\` (\`title\`) VALUES ('row-${i}')`;
          const result = await mysqlBaseModel.execAndGetRows(q, trx);
          responses.push(...result);
        }

        expect(responses).to.have.length(3);
        responses.forEach((r) => {
          expect(r).to.have.property('insertId');
          expect(r.insertId).to.be.a('number');
        });

        await trx.commit();
      } catch (e) {
        await trx.rollback();
        throw e;
      }
    });

    it('SELECT returns an array of rows', async () => {
      await mysqlKnex(MYSQL_TEST_TABLE).insert([
        { title: 'a' },
        { title: 'b' },
      ]);

      const selectQuery = `SELECT * FROM \`${MYSQL_TEST_TABLE}\``;
      const result = await mysqlBaseModel.execAndGetRows(selectQuery);

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
      expect(result[0]).to.have.property('title');
    });
  });

  describe('execAndParse', () => {
    it('returns an array by default', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      await baseModelSql.insert(
        generateDefaultRowAttributes({ columns }),
        request,
      );

      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb);

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
    });

    it('returns a single record with { first: true }', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      const bulkData = Array(5)
        .fill(0)
        .map((_, index) => generateDefaultRowAttributes({ columns, index }));
      await baseModelSql.bulkInsert(bulkData, { cookie: request });

      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb, null, { first: true });

      // Should be a single object, not an array
      expect(result).to.not.be.an('array');
      expect(result).to.be.an('object');
      expect(result).to.have.property('id');
    });

    it('returns an empty array when no rows match', async () => {
      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb);

      expect(result).to.be.an('array');
      expect(result).to.have.length(0);
    });

    it('returns undefined with { first: true } on empty result', async () => {
      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb, null, { first: true });

      expect(result).to.be.undefined;
    });

    it('skips conversions when raw is true', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      await baseModelSql.insert(
        generateDefaultRowAttributes({ columns }),
        request,
      );

      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb, null, { raw: true });

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0]).to.be.an('object');
    });

    it('handles string query input', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      await baseModelSql.insert(
        generateDefaultRowAttributes({ columns }),
        request,
      );

      const query = baseModelSql
        .dbDriver(baseModelSql.tnPath)
        .select('*')
        .toQuery();
      const result = await baseModelSql.execAndParse(query);

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
    });

    it('returns multiple records as array', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      const bulkData = Array(10)
        .fill(0)
        .map((_, index) => generateDefaultRowAttributes({ columns, index }));
      await baseModelSql.bulkInsert(bulkData, { cookie: request });

      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb);

      expect(result).to.be.an('array');
      expect(result).to.have.length(10);

      result.forEach((row) => {
        expect(row).to.be.an('object');
        expect(row).to.have.property('id');
      });
    });

    it('first: true returns only one record when multiple exist', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      const bulkData = Array(5)
        .fill(0)
        .map((_, index) => generateDefaultRowAttributes({ columns, index }));
      await baseModelSql.bulkInsert(bulkData, { cookie: request });

      const qb = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const result = await baseModelSql.execAndParse(qb, null, { first: true });

      expect(result).to.not.be.an('array');
      expect(result).to.be.an('object');
      expect(result).to.have.property('id');
    });

    it('raw and non-raw return same row count', async () => {
      const columns = await table.getColumns(ctx);
      const request = {
        clientIp: '::ffff:192.0.0.1',
        user: context.user,
      };

      const bulkData = Array(3)
        .fill(0)
        .map((_, index) => generateDefaultRowAttributes({ columns, index }));
      await baseModelSql.bulkInsert(bulkData, { cookie: request });

      const qb1 = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');
      const qb2 = baseModelSql.dbDriver(baseModelSql.tnPath).select('*');

      const normal = await baseModelSql.execAndParse(qb1);
      const raw = await baseModelSql.execAndParse(qb2, null, { raw: true });

      expect(normal).to.have.length(3);
      expect(raw).to.have.length(3);
    });
  });
}

export default function () {
  describe('execAndParse', execAndParseTests);
}
