import { expect } from 'chai';
import request from 'supertest';

import { UITypes } from 'nocodb-sdk';
import { Model } from '../../../src/models';
import Base from '../../../src/models/Base';
import { createProject } from '../factory/base';
import {
  createLookupColumn,
  createLtarColumn2,
  createRollupColumn,
  customColumns,
} from '../factory/column';
import { createBulkRows } from '../factory/row';
import { createTable } from '../factory/table';
import init from '../init';

export interface ITestContext {
  context: Awaited<ReturnType<typeof init>>;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  base: Base;
  tables: {
    table1: Model;
    table2: Model;
    table3: Model;
    table4: Model;
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
  return Array.from({ length: 40 }).map((v, i) => {
    return {
      Title: `${tableName}_${(i + 1).toString().padStart(3, '0')}`,
    };
  });
};

const getDuplicatedRows = (tableName: string) => {
  return Array.from({ length: 40 }).map((v, i) => {
    return {
      Title: `${tableName}_${((i + 1) % 5).toString().padStart(3, '0')}`,
    };
  });
};

/**
 * Sets up the test environment with base, table, view, and BaseModelSql instance
 * Used by: tests/unit/formula/tests/formula-lookup-ltar.test.ts
 */
export async function initInitialModel() {
  const context = await init();
  const base = await createProject(context);

  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };

  const columns = [
    {
      title: 'Title',
      column_name: 'Title',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
  ];
  const table1 = await createTable(context, base, {
    title: 'Table1',
    table_name: 'table1',
    columns: customColumns('custom', columns),
  });
  // insert records
  await createBulkRows(context, {
    base: base,
    table: table1,
    values: getRows('T1'),
  });
  const table2 = await createTable(context, base, {
    title: 'Table2',
    table_name: 'table2',
    columns: customColumns('custom', columns),
  });
  // insert records
  await createBulkRows(context, {
    base: base,
    table: table2,
    values: getRows('T2'),
  });
  const table3 = await createTable(context, base, {
    title: 'Table3',
    table_name: 'table3',
    columns: customColumns('custom', columns),
  });
  // insert records
  await createBulkRows(context, {
    base: base,
    table: table3,
    values: getRows('T3'),
  });
  const table4 = await createTable(context, base, {
    title: 'Table4',
    table_name: 'table4',
    columns: customColumns('custom', columns),
  });
  // insert records
  await createBulkRows(context, {
    base: base,
    table: table4,
    values: getDuplicatedRows('T4'),
  });

  // Create links
  const t3_HM_t2_Ltar = await createLtarColumn2(context, {
    title: 'T2s',
    parentTable: table3,
    childTable: table2,
    type: 'hm',
  });
  // Create links
  const t3_HM_t4_Ltar = await createLtarColumn2(context, {
    title: 'T4s',
    parentTable: table3,
    childTable: table4,
    type: 'hm',
  });
  const t2_HM_t1_Ltar = await createLtarColumn2(context, {
    title: 'T1s',
    parentTable: table2,
    childTable: table1,
    type: 'hm',
  });

  const source = (await Base.getByTitleOrId(ctx, base.id)).getSources();
  await createLookupColumn(context, {
    base,
    title: 'table1Name',
    table: await Model.getByIdOrName(ctx, {
      base_id: base.id,
      source_id: source.id!,
      id: table2.id,
    }),
    relatedTableName: table1.table_name,
    relatedTableColumnTitle: 'Title',
    relationColumnId: t2_HM_t1_Ltar.id,
  });
  await createLookupColumn(context, {
    base,
    title: 'table2Name',
    table: await Model.getByIdOrName(ctx, {
      base_id: base.id,
      source_id: source.id!,
      id: table3.id,
    }),
    relatedTableName: table2.table_name,
    relatedTableColumnTitle: 'Title',
    relationColumnId: t3_HM_t2_Ltar.id,
  });
  await createLookupColumn(context, {
    base,
    title: 'table2_table1s',
    table: await Model.getByIdOrName(ctx, {
      base_id: base.id,
      source_id: source.id!,
      id: table3.id,
    }),
    relatedTableName: table2.table_name,
    relatedTableColumnTitle: 'T1s',
    relationColumnId: t3_HM_t2_Ltar.id,
  });

  const linkTo_t2_HM_t1_Ltar = (rowId: string, body: any[]) => {
    ncAxiosLinkAdd({
      context: {
        context,
        base,
      },
      urlParams: {
        tableId: table2.id,
        linkId: t2_HM_t1_Ltar.id,
        rowId: rowId,
      },
      body: body,
      status: 200,
    });
  };
  const linkTo_t3_HM_t2_Ltar = (rowId: string, body: any[]) => {
    ncAxiosLinkAdd({
      context: {
        context,
        base,
      },
      urlParams: {
        tableId: table3.id,
        linkId: t3_HM_t2_Ltar.id,
        rowId: rowId,
      },
      body: body,
      status: 200,
    });
  };
  const linkTo_t3_HM_t4_Ltar = (rowId: string, body: any[]) => {
    ncAxiosLinkAdd({
      context: {
        context,
        base,
      },
      urlParams: {
        tableId: table3.id,
        linkId: t3_HM_t4_Ltar.id,
        rowId: rowId,
      },
      body: body,
      status: 200,
    });
  };
  await linkTo_t2_HM_t1_Ltar('1', [{ id: 1 }, { id: 2 }, { id: 3 }]);
  await linkTo_t2_HM_t1_Ltar('2', [{ id: 4 }, { id: 5 }, { id: 6 }]);
  await linkTo_t2_HM_t1_Ltar('3', [{ id: 7 }]);
  await linkTo_t3_HM_t2_Ltar('1', [{ id: 1 }, { id: 2 }]);
  await linkTo_t3_HM_t2_Ltar('2', [{ id: 3 }]);
  await linkTo_t3_HM_t4_Ltar(
    '1',
    Array.from({ length: 20 }).map((v, i) => ({ id: i + 1 })),
  );

  return {
    context,
    ctx,
    base,
    tables: {
      table1,
      table2,
      table3,
      table4,
    },
  } as ITestContext;
}

export async function initRollupColumns(context: ITestContext) {
  const t1TitleCount = await createRollupColumn(context.context, {
    base: context.base,
    title: 'T1TitleCount',
    rollupFunction: 'count',
    table: context.tables.table2,
    relatedTableName: context.tables.table1.table_name,
    relatedTableColumnTitle: 'Title',
  });
  const t1_HM_t2_Ltar = await createLtarColumn2(context.context, {
    title: 'T2s',
    parentTable: context.tables.table1,
    childTable: context.tables.table2,
    type: 'hm',
  });

  return {
    t1TitleCount,
    t1_HM_t2_Ltar,
  };
}
