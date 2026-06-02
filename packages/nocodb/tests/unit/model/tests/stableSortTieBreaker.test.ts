import 'mocha';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import type View from '~/models/View';
import type Base from '~/models/Base';
import type Model from '~/models/Model';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// Regression test for issue #13931:
// When a table has no auto-increment primary key AND no system CreatedTime
// column (the external-table case), paginated reads sorted by a non-unique
// column produced non-deterministic ORDER BY and the XLSX/CSV export
// duplicated and skipped rows at page boundaries.
//
// The fix adds a non-AI primary-key fallback to the stable-ordering block,
// so the generated SQL always includes a deterministic tie-breaker.
function stableSortTieBreakerTests() {
  let context;
  let ctx: { workspace_id: string; base_id: string };
  let base: Base;
  let table: Model;
  let view: View;
  let source: Source;

  beforeEach(async () => {
    context = await init();
    base = await createProject(context);
    ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
    table = await createTable(context, base);
    view = (await table.getViews(ctx))[0];
    source = await Source.get(ctx, table.source_id);
  });

  it('appends a primary-key tie-breaker when the PK is not auto-increment and no system CreatedTime exists', async () => {
    const columns = await table.getColumns(ctx);
    const pkColumn = columns.find((c) => c.uidt === UITypes.ID)!;
    const sortColumn = columns.find((c) => c.uidt === UITypes.SingleLineText)!;
    expect(pkColumn, 'expected an ID column').to.exist;
    expect(sortColumn, 'expected a non-PK text column to sort on').to.exist;

    // Simulate the external-table scenario from #13931 by mutating the
    // in-memory model: clear the auto-increment flag on the PK and strip
    // system CreatedTime columns from the column list. primaryKey and
    // primaryKeys are getters that read from `this.columns`.
    pkColumn.ai = false;
    table.columns = columns.filter(
      (c) => !(c.uidt === UITypes.CreatedTime && c.system),
    );

    // BaseModelSqlv2.list() calls model.getColumns() which by default
    // re-fetches from the meta DB and overwrites this.columns. Patch the
    // instance method so our in-memory mutation survives.
    table.getColumns = async () => table.columns;

    const baseModel = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(source),
      model: table,
      view,
      context: ctx,
      schema: source.getConfig()?.schema,
    });

    // Capture the SELECT SQL knex executes for list(). Knex emits a `query`
    // event for every executed statement; the data list is the SELECT that
    // hits the table's own table_name.
    const executedSqls: string[] = [];
    const driver = baseModel.dbDriver;
    const onQuery = (q: { sql: string }) => executedSqls.push(q.sql);
    driver.on('query', onQuery);

    try {
      await baseModel.list(
        {
          // Sort by a non-PK non-unique text column — this is the
          // scenario from #13931 where the export shuffled rows.
          sort: sortColumn.title,
        },
        { skipSortBasedOnOrderCol: true },
      );
    } finally {
      driver.removeListener('query', onQuery);
    }

    const selectSql = executedSqls.find(
      (s) =>
        /^\s*select/i.test(s) && s.toLowerCase().includes(table.table_name.toLowerCase()),
    );
    expect(selectSql, 'expected a SELECT against the table').to.be.a('string');

    const orderByIdx = selectSql!.toLowerCase().lastIndexOf('order by');
    expect(orderByIdx, 'expected an ORDER BY clause').to.be.greaterThan(-1);
    const orderByClause = selectSql!.slice(orderByIdx);

    // The fix appends the non-AI primary key as the stable tie-breaker.
    expect(
      orderByClause.toLowerCase(),
      `expected ORDER BY to include the primary key column "${pkColumn.column_name}" as a tie-breaker — got: ${orderByClause}`,
    ).to.include(pkColumn.column_name.toLowerCase());
  });
}

export default function () {
  describe('Stable sort tie-breaker (issue #13931)', stableSortTieBreakerTests);
}
