// Generated: 2024-12-19T10:30:00Z
import { UITypes } from 'nocodb-sdk';
import { createProject } from '../../factory/base';
import { customColumns } from '../../factory/column';
import { createBulkRows } from '../../factory/row';
import { createTable } from '../../factory/table';
import init from '../../init';
import type Base from '../../../../src/models/Base';

export interface ITestContext {
  context: Awaited<ReturnType<typeof init>>;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  base: Base;
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
 * Used by: tests/unit/processor/duplicate/*
 */
export async function initDuplicate() {
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
  };
}
