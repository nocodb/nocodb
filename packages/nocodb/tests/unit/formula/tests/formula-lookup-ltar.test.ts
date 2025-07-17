import 'mocha';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import init from '../../init';
import type Base from '~/models/Base';
import type Model from '~/models/Model';
import type View from '~/models/View';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

function formulaLookupLtarTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;
  let table: Model;
  let view: View;
  let baseModelSql: BaseModelSqlv2;

  beforeEach(async function () {
    console.time('#### formulaLookupLtarTests');
    context = await init();
    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    table = await createTable(context, base);
    view = await table.getViews(ctx)[0];

    const source = await Source.get(ctx, table.source_id);
    baseModelSql = new BaseModelSqlv2({
      dbDriver: await NcConnectionMgrv2.get(source),
      model: table,
      view,
      context: ctx,
    });
    console.timeEnd('#### formulaLookupLtarTests');
  });

  it('will serve as placeholder', () => {});
}

export function formulaLookupLtarTest() {
  describe('BaseModelSql', formulaLookupLtarTests);
}
