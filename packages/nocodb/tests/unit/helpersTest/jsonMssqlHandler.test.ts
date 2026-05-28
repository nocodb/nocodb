import 'mocha';
import { expect } from 'chai';
import knexLib from 'knex';
import { JsonMssqlHandler } from '~/db/field-handler/handlers/json/json.mssql.handler';
import type { Column, Filter } from '~/models';

// SQL Server's native `json` type (2025 / Azure SQL) forbids implicit string
// comparison, like `xml` (json-data-type.md: "All implicit conversions aren't
// allowed, similar to the behavior of xml"). So comparisons must
// CAST(col AS NVARCHAR(MAX)) and inserts must CAST(@p AS json). But an
// `nvarchar` column manually typed as JSON (the only option on 2016-2022) must
// stay plain string. The handler gates the cast on the column's `dt`.

function jsonMssqlHandlerTests() {
  describe('JsonMssqlHandler — casts native json, leaves nvarchar JSON plain', () => {
    // No connection is opened; `.toString()` compiles SQL offline.
    const knex: any = knexLib({ client: 'mssql' });
    const handler = new JsonMssqlHandler();
    const mkCol = (dt: string): Column =>
      ({ column_name: 'doc', title: 'doc', uidt: 'JSON', meta: {}, dt } as any);

    async function sqlFor(dt: string, filter: Partial<Filter>) {
      const res = await handler.filter(
        knex,
        filter as Filter,
        mkCol(dt),
        { knex } as any,
      );
      return knex('t').where(res.clause).toString();
    }

    it('wraps a native json column in CAST(... AS NVARCHAR(MAX)) for eq', async () => {
      const sql = await sqlFor('json', { comparison_op: 'eq', value: '{"k":1}' });
      expect(sql).to.contain('CAST([doc] AS NVARCHAR(MAX)) = ');
    });

    it('does NOT cast an nvarchar column manually typed as JSON', async () => {
      const sql = await sqlFor('nvarchar', {
        comparison_op: 'eq',
        value: '{"k":1}',
      });
      expect(sql).to.not.contain('CAST(');
      expect(sql).to.contain('[doc] = ');
    });

    it('casts native json for like and blank as well', async () => {
      const like = await sqlFor('json', { comparison_op: 'like', value: 'x' });
      expect(like).to.contain('CAST([doc] AS NVARCHAR(MAX)) like ');

      const blank = await sqlFor('json', { comparison_op: 'blank' });
      expect(blank).to.contain("CAST([doc] AS NVARCHAR(MAX)) = '{}'");
      // IS NULL never needs a cast.
      expect(blank).to.contain('[doc] is null');
    });

    it('parseUserInput casts to json only for a native json column', async () => {
      const baseModel: any = { dbDriver: knex };
      const nv = await handler.parseUserInput({
        value: '{"a":1}',
        row: {},
        column: mkCol('nvarchar'),
        options: { baseModel },
      } as any);
      expect(nv.value).to.equal('{"a":1}');

      const js = await handler.parseUserInput({
        value: '{"a":1}',
        row: {},
        column: mkCol('json'),
        options: { baseModel },
      } as any);
      expect(js.value?.toString?.()).to.contain('CAST(');
      expect(js.value?.toString?.()).to.contain('AS json');
    });
  });
}

export function jsonMssqlHandlerTest() {
  jsonMssqlHandlerTests();
}
