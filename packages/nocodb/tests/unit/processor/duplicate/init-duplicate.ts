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

const getRowsForTable2 = (tableName: string) => {
  return Array.from({ length: 40 }).map((v, i) => {
    return {
      Title: `${tableName}_${(i + 1).toString().padStart(3, '0')}`,
      Number: i + 1,
      Date: new Date(2024, 0, (i % 28) + 1).toISOString().slice(0, 10),
      DateTime: new Date(2024, 0, (i % 28) + 1, 12, 0, 0).toISOString(),
      SingleSelect: ['option1', 'option2', 'option3'][i % 3],
      MultiSelect: i % 2 === 0 ? 'tag1,tag2' : 'tag2,tag3',
      Checkbox: i % 2 === 0,
      Email: `test${i + 1}@example.com`,
      Currency: (i + 1) * 10.5,
      Percent: (i + 1) * 2.5,
      Rating: (i % 5) + 1,
    };
  });
};

const getDuplicatedRowsForTable2 = (tableName: string) => {
  return Array.from({ length: 40 }).map((v, i) => {
    const index = (i + 1) % 5;
    return {
      Title: `${tableName}_${index.toString().padStart(3, '0')}`,
      Number: index,
      Date: new Date(2024, 0, (index % 28) + 1).toISOString().slice(0, 10),
      DateTime: new Date(2024, 0, (index % 28) + 1, 12, 0, 0).toISOString(),
      SingleSelect: ['option1', 'option2', 'option3'][index % 3],
      MultiSelect: index % 2 === 0 ? 'tag1,tag2' : 'tag2,tag3',
      Checkbox: index % 2 === 0,
      Email: `test${index}@example.com`,
      Currency: index * 10.5,
      Percent: index * 2.5,
      Rating: (index % 5) + 1,
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
  const table2Columns = [
    {
      title: 'Title',
      column_name: 'Title',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
    {
      title: 'Number',
      column_name: 'Number',
      uidt: UITypes.Number,
    },
    {
      title: 'Date',
      column_name: 'Date',
      uidt: UITypes.Date,
      meta: {
        date_format: 'YYYY/MM/DD',
      },
    },
    {
      title: 'DateTime',
      column_name: 'DateTime',
      uidt: UITypes.DateTime,
      meta: {
        date_format: 'YYYY/MM/DD',
        time_format: 'h:mm:ss',
        '12hr_format': true,
      },
    },
    {
      title: 'SingleSelect',
      column_name: 'SingleSelect',
      uidt: UITypes.SingleSelect,
      dtxp: "'option1','option2','option3'",
    },
    {
      title: 'MultiSelect',
      column_name: 'MultiSelect',
      uidt: UITypes.MultiSelect,
      dtxp: "'tag1','tag2','tag3'",
    },
    {
      title: 'Checkbox',
      column_name: 'Checkbox',
      uidt: UITypes.Checkbox,
    },
    {
      title: 'Email',
      column_name: 'Email',
      uidt: UITypes.Email,
      meta: {
        validation: true,
      },
    },
    {
      title: 'Currency',
      column_name: 'Currency',
      uidt: UITypes.Currency,
      meta: {
        currency_locale: 'en-USD',
        currency_code: 'USD',
      },
    },
    {
      title: 'Percent',
      column_name: 'Percent',
      uidt: UITypes.Percent,
      meta: {
        is_progress: true,
      },
    },
    {
      title: 'Rating',
      column_name: 'Rating',
      uidt: UITypes.Rating,
      meta: {
        iconIdx: 'mdi-star',
        max: 5,
        color: '#fcb401',
      },
    },
  ];

  const table2 = await createTable(context, base, {
    title: 'Table2',
    table_name: 'table2',
    columns: table2Columns,
  });
  // insert records
  await createBulkRows(context, {
    base: base,
    table: table2,
    values: getRowsForTable2('T2'),
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

export { getRows, getDuplicatedRows, getRowsForTable2, getDuplicatedRowsForTable2 };
