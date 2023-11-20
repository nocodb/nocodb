import { test } from '@playwright/test';
import setup, { unsetup } from '../../../setup';
import { UITypes } from 'nocodb-sdk';
import { Api } from 'nocodb-sdk';
let api: Api<any>;

// configuration

// To use, modify the test.skip to test.only
// Add columns as required to megaTblColumns
// Add row count as required to megaTblRows

const megaTblColumns = [
  { type: 'SingleLineText', count: 30 },
  { type: 'LongText', count: 100 },
  { type: 'Number', count: 30 },
  { type: 'Checkbox', count: 30 },
  { type: 'SingleSelect', count: 30 },
  { type: 'MultiSelect', count: 100 },
  { type: 'Date', count: 100 },
  { type: 'DateTime', count: 100 },
  { type: 'Email', count: 100 },
  { type: 'Currency', count: 100 },
  { type: 'Duration', count: 100 },
  { type: 'Rating', count: 100 },
];
const megaTblRows = 1000;
const bulkInsertAfterRows = 1000;
const formulaRowCnt = 100;

test.describe.serial('Test table', () => {
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.skip('mega table', async ({ page }) => {
    let table_1;
    const table_1_columns = [];

    // a Primary key column & display column
    table_1_columns.push(
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'SingleLineText',
        title: 'SingleLineText',
        uidt: UITypes.SingleLineText,
        pv: true,
      }
    );

    for (let i = 0; i < megaTblColumns.length; i++) {
      for (let j = 0; j < megaTblColumns[i].count; j++) {
        // skip if Formula
        if (megaTblColumns[i].type === 'Formula') continue;
        const column = {
          column_name: `${megaTblColumns[i].type}${j}`,
          title: `${megaTblColumns[i].type}${j}`,
          uidt: UITypes[megaTblColumns[i].type],
        };
        if (megaTblColumns[i].type === 'SingleSelect' || megaTblColumns[i].type === 'MultiSelect') {
          column['dtxp'] = "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'";
        }
        if (megaTblColumns[i].type === 'Email') {
          column['meta'] = {
            validate: true,
          };
        }
        table_1_columns.push(column);
      }
    }

    try {
      const base = await api.base.read(context.base.id);
      table_1 = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'table_1',
        title: 'table_1',
        columns: table_1_columns,
      });

      // run loop for formula count
      for (let i = 0; i < formulaRowCnt; i++) {
        table_1 = await api.dbTableColumn.create(table_1.id, {
          column_name: `Formula${i}`,
          title: `Formula${i}`,
          uidt: UITypes.Formula,
          formula_raw: '{SingleLineText}',
        });
      }

      const table_1_rows = [];
      for (let rowCnt = 0; rowCnt < megaTblRows; rowCnt++) {
        const row = {
          Id: rowCnt + 1,
          SingleLineText: `SingleLineText${rowCnt + 1}`,
        };
        for (let colCnt = 0; colCnt < megaTblColumns.length; colCnt++) {
          if (megaTblColumns[colCnt].type === 'Formula') continue;
          for (let colInstanceCnt = 0; colInstanceCnt < megaTblColumns[colCnt].count; colInstanceCnt++) {
            const columnName = `${megaTblColumns[colCnt].type}${colInstanceCnt}`;
            if (megaTblColumns[colCnt].type === 'SingleLineText') {
              row[columnName] = `SingleLineText${rowCnt + 1}`;
            } else if (
              megaTblColumns[colCnt].type === 'Number' ||
              megaTblColumns[colCnt].type === 'Currency' ||
              megaTblColumns[colCnt].type === 'Duration'
            ) {
              row[columnName] = rowCnt + 1;
            } else if (megaTblColumns[colCnt].type === 'Checkbox') {
              row[columnName] = rowCnt % 2 === 0;
            } else if (megaTblColumns[colCnt].type === 'SingleSelect') {
              row[columnName] = 'jan';
            } else if (megaTblColumns[colCnt].type === 'MultiSelect') {
              row[columnName] = 'jan,feb,mar,apr';
            } else if (megaTblColumns[colCnt].type === 'LongText') {
              row[columnName] = `Some length text here. Some length text here`;
            } else if (megaTblColumns[colCnt].type === 'DateTime') {
              row[columnName] = '2023-04-25 16:25:11+05:30';
            } else if (megaTblColumns[colCnt].type === 'Date') {
              row[columnName] = '2023-04-25 16:25:11+05:30';
            } else if (megaTblColumns[colCnt].type === 'Email') {
              row[columnName] = 'raju@nocodb.com';
            } else if (megaTblColumns[colCnt].type === 'Rating') {
              row[columnName] = (rowCnt % 5) + 1;
            }
          }
        }
        table_1_rows.push(row);

        // insert as soon as we have 1k records ready
        if (table_1_rows.length === bulkInsertAfterRows) {
          await api.dbTableRow.bulkCreate('noco', context.base.id, table_1.id, table_1_rows);
          console.log(`table_1_rows ${rowCnt + 1} created`);
          table_1_rows.length = 0;
        }
      }

      if (table_1_rows.length > 0) {
        await api.dbTableRow.bulkCreate('noco', context.base.id, table_1.id, table_1_rows);
        console.log(`table_1_rows ${megaTblRows} created`);
      }
    } catch (e) {
      console.log(e);
    }

    await page.reload();
  });

  test.skip('mega table - LinkToAnotherRecord', async ({ page }) => {
    let table_1, table_2;
    const columns = [];

    // a Primary key column & display column
    columns.push(
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'SingleLineText',
        title: 'SingleLineText',
        uidt: UITypes.SingleLineText,
        pv: true,
      }
    );

    const base = await api.base.read(context.base.id);
    // eslint-disable-next-line prefer-const
    table_1 = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: 'table_1',
      title: 'table_1',
      columns: columns,
    });
    // eslint-disable-next-line prefer-const
    table_2 = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: 'table_2',
      title: 'table_2',
      columns: columns,
    });

    const rows = [];
    for (let i = 0; i < 1000; i++) {
      rows.push({
        Id: i + 1,
        SingleLineText: `SingleLineText${i + 1}`,
      });
    }
    await api.dbTableRow.bulkCreate('noco', context.base.id, table_1.id, rows);
    await api.dbTableRow.bulkCreate('noco', context.base.id, table_2.id, rows);

    await api.dbTableColumn.create(table_2.id, {
      uidt: UITypes.Links,
      title: 'Links',
      column_name: 'Links',
      parentId: table_1.id,
      childId: table_2.id,
      type: 'hm',
    });

    // // nested add : hm
    // for (let i = 1; i <= 1000; i++) {
    //   await api.dbTableRow.nestedAdd('noco', base.title, table_1.table_name, i, 'hm', 'LinkToAnotherRecord', `${i}`);
    // }

    // nested add : bt
    for (let i = 1; i <= 1000; i++) {
      await api.dbTableRow.nestedAdd('noco', base.title, table_2.table_name, i, 'bt', 'table_1', `${i}`);
    }
  });
});
