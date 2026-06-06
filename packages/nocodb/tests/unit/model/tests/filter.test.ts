import 'mocha';
import { expect } from 'chai';
import init from '~test/init';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import Filter from '~/models/Filter';
import type Base from '~/models/Base';
import type Model from '~/models/Model';
import type View from '~/models/View';

function filterTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;
  let table: Model;
  let view: View;
  let columnId: string;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    table = await createTable(context, base);
    const views = await table.getViews(ctx);
    view = views[0];
    const columns = await table.getColumns(ctx);
    columnId = (columns.find((c) => !c.system) ?? columns[0]).id;
  });

  // Regression: a multi-select (anyof/nanyof) filter stores option titles joined
  // by commas. With many options the value easily exceeds 255 chars. Filter.update
  // used to slice the value to 255 (a leftover from when the column was varchar(255),
  // later widened to text), silently dropping the trailing option on every edit.
  it('keeps a >255 char filter value intact through insert + update', async () => {
    const longValue = Array.from({ length: 30 }, (_, i) => `Option ${i}`).join(
      ',',
    );
    expect(longValue.length).to.be.greaterThan(255);

    const created = await Filter.insert(ctx, {
      fk_view_id: view.id,
      fk_column_id: columnId,
      comparison_op: 'anyof',
      logical_op: 'and',
      value: longValue,
    });

    // insert has never truncated — full value is persisted
    const afterInsert = await Filter.get(ctx, created.id);
    expect(afterInsert.value).to.equal(longValue);

    // editing the filter goes through Filter.update — must not truncate either
    const longValue2 = Array.from(
      { length: 35 },
      (_, i) => `Choice ${i}`,
    ).join(',');
    expect(longValue2.length).to.be.greaterThan(255);

    await Filter.update(ctx, created.id, { value: longValue2 });

    const afterUpdate = await Filter.get(ctx, created.id);
    expect(afterUpdate.value.length).to.be.greaterThan(255);
    expect(afterUpdate.value).to.equal(longValue2);
  });
}

export default filterTests;
