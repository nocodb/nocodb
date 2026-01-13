import { createProject } from '../factory/base';
import init from '../init';
import type Base from '../../../src/models/Base';

export interface ITestContext {
  context: Awaited<ReturnType<typeof init>>;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  base: Base;
  tables: any;
}

/**
 * Sets up the test environment with base, table, view, and BaseModelSql instance
 * Used by: tests/unit/formula/tests/formula-lookup-ltar.test.ts
 */
export async function initInitialModel() {
  console.time('#### formulaLookupLtarTests');
  const context = await init();
  const base = await createProject(context);

  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };

  return {
    context,
    ctx,
    base,
    tables: {},
  } as ITestContext;
}
