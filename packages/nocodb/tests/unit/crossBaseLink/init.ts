import { expect } from 'chai';
import request from 'supertest';

import { UITypes } from 'nocodb-sdk';
import { createProject } from '../factory/base';
import { createColumn, customColumns } from '../factory/column';
import { createBulkRows } from '../factory/row';
import { createTable } from '../factory/table';
import init from '../init';
import type Base from '../../../src/models/Base';
import type { Model } from '../../../src/models';
import type { Column } from '../../../src/models';

export interface ICrossBaseTestContext {
  context: Awaited<ReturnType<typeof init>>;
  bases: {
    base1: Base;
    base2: Base;
  };
  contexts: {
    ctx1: { workspace_id: string; base_id: string };
    ctx2: { workspace_id: string; base_id: string };
  };
  tables: {
    t1_base1: Model;
    t2_base1: Model;
    t1_base2: Model;
    t2_base2: Model;
  };
  crossLinks: {
    b1t1_HM_b2t1: Column;
    b1t1_MM_b2t2: Column;
    b1t2_OO_b2t1: Column;
    b2t1_BT_b1t1: Column;
  };
}

async function ncAxiosLinkAdd({
  context,
  urlParams,
  body = {},
  status = 200,
  msg,
}: {
  context: { context: any; base: any };
  urlParams: { tableId: string; linkId: string; rowId: string };
  body?: any;
  status?: number;
  msg?: string;
}) {
  const url = `/api/v3/data/${context.base.id}/${urlParams.tableId}/links/${urlParams.linkId}/${urlParams.rowId}`;
  const response = await request(context.context.app)
    .post(url)
    .set('xc-auth', context.context.token)
    .send(body);
  expect(response.status).to.equal(status);
  if (msg) {
    expect(response.body.message || response.body.msg).to.equal(msg);
  }
  return response;
}

const getRows = (tableName: string) => {
  return Array.from({ length: 40 }).map((_, i) => {
    return {
      Title: `${tableName}_${(i + 1).toString().padStart(3, '0')}`,
    };
  });
};

const getNumberRows = (tableName: string) => {
  return Array.from({ length: 40 }).map((_, i) => {
    return {
      Title: `${tableName}_${(i + 1).toString().padStart(3, '0')}`,
      Amount: (i + 1) * 10,
    };
  });
};

/**
 * Creates a cross-base LTAR column by specifying ref_base_id
 */
const createCrossBaseLtarColumn = async (
  context: Awaited<ReturnType<typeof init>>,
  {
    title,
    parentTable,
    childTable,
    refBaseId,
    type,
  }: {
    title: string;
    parentTable: Model;
    childTable: Model;
    refBaseId: string;
    type: string;
  },
) => {
  const ltarColumn = await createColumn(context, parentTable, {
    title: title,
    column_name: title,
    uidt: UITypes.LinkToAnotherRecord,
    parentId: parentTable.id,
    childId: childTable.id,
    ref_base_id: refBaseId,
    type: type,
  });

  return ltarColumn;
};

/**
 * Sets up the test environment with two bases and cross-base links
 * Used by: tests/unit/crossBaseLink tests
 */
export async function initCrossBaseModel(): Promise<ICrossBaseTestContext> {
  console.time('#### crossBaseLinkTests');
  const context = await init();

  // Create two bases in the same workspace
  const base1 = await createProject(context, { title: 'CrossBaseTest1' });
  const base2 = await createProject(context, { title: 'CrossBaseTest2' });

  const ctx1 = {
    workspace_id: base1.fk_workspace_id,
    base_id: base1.id,
  };

  const ctx2 = {
    workspace_id: base2.fk_workspace_id,
    base_id: base2.id,
  };

  // Define columns for tables
  const titleColumns = [
    {
      title: 'Title',
      column_name: 'Title',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
  ];

  const numberColumns = [
    {
      title: 'Title',
      column_name: 'Title',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
    {
      title: 'Amount',
      column_name: 'Amount',
      uidt: UITypes.Number,
    },
  ];

  // Create tables in base1
  const t1_base1 = await createTable(context, base1, {
    title: 'Table1',
    table_name: 'table1',
    columns: customColumns('custom', titleColumns),
  });
  await createBulkRows(context, {
    base: base1,
    table: t1_base1,
    values: getRows('B1T1'),
  });

  const t2_base1 = await createTable(context, base1, {
    title: 'Table2',
    table_name: 'table2',
    columns: customColumns('custom', titleColumns),
  });
  await createBulkRows(context, {
    base: base1,
    table: t2_base1,
    values: getRows('B1T2'),
  });

  // Create tables in base2
  const t1_base2 = await createTable(context, base2, {
    title: 'Table1',
    table_name: 'table1',
    columns: customColumns('custom', titleColumns),
  });
  await createBulkRows(context, {
    base: base2,
    table: t1_base2,
    values: getRows('B2T1'),
  });

  const t2_base2 = await createTable(context, base2, {
    title: 'Table2',
    table_name: 'table2',
    columns: customColumns('custom', numberColumns),
  });
  await createBulkRows(context, {
    base: base2,
    table: t2_base2,
    values: getNumberRows('B2T2'),
  });

  // Create cross-base HM link: base1.table1 -> base2.table1
  const b1t1_HM_b2t1 = await createCrossBaseLtarColumn(context, {
    title: 'B2T1s',
    parentTable: t1_base1,
    childTable: t1_base2,
    refBaseId: base2.id,
    type: 'hm',
  });

  // Get the BT column created on base2.table1 (reverse of HM)
  const b2t1_BT_b1t1 = (await t1_base2.getColumns(ctx2)).find(
    (col) =>
      col.uidt === UITypes.LinkToAnotherRecord &&
      col.colOptions?.fk_related_model_id === t1_base1.id,
  );

  // Create cross-base MM link: base1.table1 <-> base2.table2
  const b1t1_MM_b2t2 = await createCrossBaseLtarColumn(context, {
    title: 'B2T2sMM',
    parentTable: t1_base1,
    childTable: t2_base2,
    refBaseId: base2.id,
    type: 'mm',
  });

  // Create cross-base OO link: base1.table2 -> base2.table1
  const b1t2_OO_b2t1 = await createCrossBaseLtarColumn(context, {
    title: 'B2T1OO',
    parentTable: t2_base1,
    childTable: t1_base2,
    refBaseId: base2.id,
    type: 'oo',
  });

  // Link helper functions
  const linkTo_b1t1_HM_b2t1 = (rowId: string, body: any[]) => {
    return ncAxiosLinkAdd({
      context: { context, base: base1 },
      urlParams: {
        tableId: t1_base1.id,
        linkId: b1t1_HM_b2t1.id,
        rowId: rowId,
      },
      body: body,
      status: 200,
    });
  };

  const linkTo_b1t1_MM_b2t2 = (rowId: string, body: any[]) => {
    return ncAxiosLinkAdd({
      context: { context, base: base1 },
      urlParams: {
        tableId: t1_base1.id,
        linkId: b1t1_MM_b2t2.id,
        rowId: rowId,
      },
      body: body,
      status: 200,
    });
  };

  const linkTo_b1t2_OO_b2t1 = (rowId: string, body: any[]) => {
    return ncAxiosLinkAdd({
      context: { context, base: base1 },
      urlParams: {
        tableId: t2_base1.id,
        linkId: b1t2_OO_b2t1.id,
        rowId: rowId,
      },
      body: body,
      status: 200,
    });
  };

  // Establish HM links
  await linkTo_b1t1_HM_b2t1('1', [{ id: 1 }, { id: 2 }, { id: 3 }]);
  await linkTo_b1t1_HM_b2t1('2', [{ id: 4 }, { id: 5 }]);
  await linkTo_b1t1_HM_b2t1('3', [{ id: 6 }]);

  // Establish MM links
  await linkTo_b1t1_MM_b2t2('1', [{ id: 1 }, { id: 2 }]);
  await linkTo_b1t1_MM_b2t2('2', [{ id: 2 }, { id: 3 }, { id: 4 }]);

  // Establish OO links
  await linkTo_b1t2_OO_b2t1('1', [{ id: 7 }]);
  await linkTo_b1t2_OO_b2t1('2', [{ id: 8 }]);

  console.timeEnd('#### crossBaseLinkTests');

  return {
    context,
    bases: { base1, base2 },
    contexts: { ctx1, ctx2 },
    tables: { t1_base1, t2_base1, t1_base2, t2_base2 },
    crossLinks: {
      b1t1_HM_b2t1,
      b1t1_MM_b2t2,
      b1t2_OO_b2t1,
      b2t1_BT_b1t1,
    },
  } as ICrossBaseTestContext;
}

export { ncAxiosLinkAdd, createCrossBaseLtarColumn };
