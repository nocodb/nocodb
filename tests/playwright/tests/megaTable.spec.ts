import { test } from '@playwright/test';
import setup from '../setup';
import { UITypes } from 'nocodb-sdk';
import { Api } from 'nocodb-sdk';
let api: Api<any>;

// configuration

// To use, modify the test.skip to test.only
// Add columns as required to megaTblColumns
// Add row count as required to megaTblRows

const megaTblColumns = [
  { type: 'SingleLineText', count: 3 },
  { type: 'Number', count: 3 },
  { type: 'Checkbox', count: 3 },
  { type: 'SingleSelect', count: 3 },
  { type: 'MultiSelect', count: 3 },
];
const megaTblRows = 50000;
const bulkInsertAfterRows = 1000;

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
        const column = {
          column_name: `${megaTblColumns[i].type}${j}`,
          title: `${megaTblColumns[i].type}${j}`,
          uidt: UITypes[megaTblColumns[i].type],
        };
        if (megaTblColumns[i].type === 'SingleSelect' || megaTblColumns[i].type === 'MultiSelect') {
          column['dtxp'] = "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'";
        }
        table_1_columns.push(column);
      }
    }

    try {
      const project = await api.project.read(context.project.id);
      table_1 = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'table_1',
        title: 'table_1',
        columns: table_1_columns,
      });

      table_1 = await api.dbTableColumn.create(table_1.id, {
        column_name: 'Formula',
        title: 'Formula',
        uidt: UITypes.Formula,
        formula_raw: '{SingleLineText}',
      });

      const table_1_rows = [];
      for (let rowCnt = 0; rowCnt < megaTblRows; rowCnt++) {
        const row = {
          Id: rowCnt + 1,
          SingleLineText: `SingleLineText${rowCnt + 1}`,
        };
        for (let colCnt = 0; colCnt < megaTblColumns.length; colCnt++) {
          for (let colInstanceCnt = 0; colInstanceCnt < megaTblColumns[colCnt].count; colInstanceCnt++) {
            const columnName = `${megaTblColumns[colCnt].type}${colInstanceCnt}`;
            if (megaTblColumns[colCnt].type === 'SingleLineText') {
              row[columnName] = `SingleLineText${rowCnt + 1}`;
            } else if (megaTblColumns[colCnt].type === 'Number') {
              row[columnName] = rowCnt + 1;
            } else if (megaTblColumns[colCnt].type === 'Checkbox') {
              row[columnName] = rowCnt % 2 === 0;
            } else if (megaTblColumns[colCnt].type === 'SingleSelect') {
              row[columnName] = 'jan';
            } else if (megaTblColumns[colCnt].type === 'MultiSelect') {
              row[columnName] = 'jan,feb,mar,apr';
            }
          }
        }
        table_1_rows.push(row);

        // insert as soon as we have 1k records ready
        if (table_1_rows.length === bulkInsertAfterRows) {
          await api.dbTableRow.bulkCreate('noco', context.project.id, table_1.id, table_1_rows);
          console.log(`table_1_rows ${rowCnt + 1} created`);
          table_1_rows.length = 0;
        }
      }

      if (table_1_rows.length > 0) {
        await api.dbTableRow.bulkCreate('noco', context.project.id, table_1.id, table_1_rows);
        console.log(`table_1_rows ${megaTblRows} created`);
      }
    } catch (e) {
      console.log(e);
    }

    await page.reload();
  });
});
