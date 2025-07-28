import { expect } from 'chai';
import 'mocha';
import { ClientType } from 'nocodb-sdk';
import { Source } from '../../../../src/models';
import { initInitialModel } from '../../formula/initModel';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

function pgErrorExtractorTests() {
  let _setup;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _tables;
  let _view;
  let _source;
  let baseModelSql: BaseModelSqlv2;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;

    const view = await setup.tables.table1.getViews(setup.ctx)[0];

    const source = await Source.get(setup.ctx, setup.tables.table1.source_id);
    _source = source;
    baseModelSql = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(source),
      model: setup.tables.table1,
      view,
      context: setup.ctx,
    });
  });

  const clientType = ClientType.PG;
  it(`will extract pg syntax error`, async () => {
    // skip if not pg
    if (_source.type !== clientType) {
      return;
    }
    const knex = baseModelSql.dbDriver;
    const columnTitle = (await _tables.table1.getColumns()).find(
      (col) => col.title === 'Title',
    );
    try {
      await knex(_tables.table1.table_name).select(
        knex.raw(`SUBSTRING (?, 0, -1) as `, [
          `${_tables.table1.table_name}.${columnTitle.column_name}`,
        ]),
      );
    } catch (ex) {
      const extractResult = DBErrorExtractor.get().extractDbError(ex, {
        clientType,
      });
      expect(extractResult.message).to.satisfy((msg) =>
        msg.startsWith('There was a syntax error in your SQL query'),
      );
    }
  });

  it(`will extract pg substring negative length error`, async () => {
    // skip if not pg
    if (_source.type !== clientType) {
      return;
    }
    const knex = baseModelSql.dbDriver;
    const columnTitle = (await _tables.table1.getColumns()).find(
      (col) => col.title === 'Title',
    );
    try {
      await knex(_tables.table1.table_name).select(
        knex.raw(`SUBSTRING (?, 0, -1) as field`, [
          `${_tables.table1.table_name}.${columnTitle.column_name}`,
        ]),
      );
    } catch (ex) {
      const extractResult = DBErrorExtractor.get().extractDbError(ex, {
        clientType,
      });
      expect(extractResult.message).to.satisfy((msg) =>
        msg.startsWith('Negative substring length not allowed'),
      );
    }
  });
}

export function pgErrorExtractorTest() {
  describe('PgErrorExtractorTest', pgErrorExtractorTests);
}
