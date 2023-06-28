import { expect, test } from '@playwright/test';
import setup from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { Api } from 'nocodb-sdk';
import { createDemoTable } from '../../setup/demoTable';
import { BulkUpdatePage } from '../../pages/Dashboard/BulkUpdate';

let dashboard: DashboardPage;
let context: any;
let api: Api<any>;
let table;
async function dragDrop({ firstColumn, lastColumn }: { firstColumn: string; lastColumn: string }) {
  await dashboard.grid.cell.get({ index: 0, columnHeader: firstColumn }).click();
  await dashboard.rootPage.keyboard.press(
    (await dashboard.grid.isMacOs()) ? 'Meta+Shift+ArrowRight' : 'Control+Shift+ArrowRight'
  );

  // get fill handle locator
  const src = await dashboard.rootPage.locator(`.nc-fill-handle`);
  const dst = await dashboard.grid.cell.get({ index: 3, columnHeader: lastColumn });

  // drag and drop
  await src.dragTo(dst);
}
async function beforeEachInit({ page, tableType }: { page: any; tableType: string }) {
  context = await setup({ page, isEmptyProject: true });
  dashboard = new DashboardPage(page, context.project);

  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });

  table = await createDemoTable({ context, type: tableType, recordCnt: 10 });
  await page.reload();

  await dashboard.treeView.openTable({ title: tableType });
}

test.describe('Fill Handle', () => {
  test.beforeEach(async ({ page }) => {
    await beforeEachInit({ page, tableType: 'textBased' });
  });

  test('Text based', async () => {
    const fields = [
      { title: 'SingleLineText', value: 'Afghanistan', type: 'text' },
      { title: 'Email', value: 'jbutt@gmail.com', type: 'text' },
      { title: 'PhoneNumber', value: '1-541-754-3010', type: 'text' },
      { title: 'URL', value: 'https://www.google.com', type: 'text' },
      { title: 'MultiLineText', value: 'Aberdeen, United Kingdom', type: 'longText' },
    ];

    await dragDrop({ firstColumn: 'SingleLineText', lastColumn: 'URL' });

    // verify data on grid (verifying just two rows)
    for (let i = 0; i < fields.length; i++) {
      for (let j = 0; j < 4; j++) {
        await dashboard.grid.cell.verify({ index: j, columnHeader: fields[i].title, value: fields[i].value });
      }
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 4 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i][fields[j].title]).toEqual(fields[j].value);
      }
    }
  });
});

test.describe('Fill Handle', () => {
  test.beforeEach(async ({ page }) => {
    await beforeEachInit({ page, tableType: 'numberBased' });
  });

  test('Number based', async () => {
    const fields = [
      { title: 'Number', value: '33', type: 'text' },
      { title: 'Decimal', value: '33.3', type: 'text' },
      { title: 'Currency', value: '33.30', type: 'text' },
      { title: 'Percent', value: '33', type: 'text' },
      { title: 'Duration', value: '00:01', type: 'text' },
      { title: 'Rating', value: '3', type: 'rating' },
      { title: 'Year', value: '2023', type: 'year' },
      // { title: 'Time', value: '10:10', type: 'time' },
    ];

    // set rating for first record
    await dashboard.grid.cell.rating.select({ index: 0, columnHeader: 'Rating', rating: 2 });

    await dragDrop({ firstColumn: 'Number', lastColumn: 'Year' });

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      for (let j = 0; j < 4; j++) {
        if (fields[i].type === 'rating') {
          await dashboard.grid.cell.rating.verify({
            index: j,
            columnHeader: fields[i].title,
            rating: +fields[i].value,
          });
        } else if (fields[i].type === 'year') {
          await dashboard.grid.cell.year.verify({ index: j, columnHeader: fields[i].title, value: +fields[i].value });
        } else if (fields[i].type === 'time') {
          await dashboard.grid.cell.time.verify({ index: j, columnHeader: fields[i].title, value: fields[i].value });
        } else {
          await dashboard.grid.cell.verify({ index: j, columnHeader: fields[i].title, value: fields[i].value });
        }
      }
    }

    // verify api response
    // duration in seconds
    const APIResponse = [33, 33.3, 33.3, 33, 60, 3, 2023, '10:10:00'];
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 4 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        if (fields[j].title === 'Time') {
          expect(updatedRecords[i][fields[j].title]).toContain(APIResponse[j]);
        } else {
          expect(+updatedRecords[i][fields[j].title]).toEqual(APIResponse[j]);
        }
      }
    }
  });
});

test.describe.skip('Fill Handle', () => {
  test.beforeEach(async ({ page }) => {
    await beforeEachInit({ page, tableType: 'selectBased' });
  });

  test('Select based', async () => {
    const fields = [
      { title: 'SingleSelect', value: 'jan', type: 'singleSelect' },
      { title: 'MultiSelect', value: 'jan,feb,mar', type: 'multiSelect' },
    ];

    await dragDrop({ firstColumn: 'SingleSelect', lastColumn: 'MultiSelect' });

    // verify data on grid
    const displayOptions = ['jan', 'feb', 'mar'];
    for (let i = 0; i < fields.length; i++) {
      for (let j = 0; j < 4; j++) {
        if (fields[i].type === 'singleSelect') {
          await dashboard.grid.cell.selectOption.verify({
            index: j,
            columnHeader: fields[i].title,
            option: fields[i].value,
          });
        } else {
          await dashboard.grid.cell.selectOption.verifyOptions({
            index: j,
            columnHeader: fields[i].title,
            options: displayOptions,
          });
        }
      }
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 4 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i][fields[j].title]).toContain(fields[j].value);
      }
    }
  });
});

test.describe('Fill Handle', () => {
  test.beforeEach(async ({ page }) => {
    await beforeEachInit({ page, tableType: 'miscellaneous' });
  });

  test('Miscellaneous (Checkbox, attachment)', async () => {
    const fields = [
      { title: 'Checkbox', value: 'true', type: 'checkbox' },
      { title: 'Attachment', value: `${process.cwd()}/fixtures/sampleFiles/1.json`, type: 'attachment' },
    ];

    await dashboard.grid.cell.checkbox.click({ index: 0, columnHeader: 'Checkbox' });
    const filepath = [`${process.cwd()}/fixtures/sampleFiles/1.json`];
    await dashboard.grid.cell.attachment.addFile({
      index: 0,
      columnHeader: 'Attachment',
      filePath: filepath,
    });
    await dragDrop({ firstColumn: 'Checkbox', lastColumn: 'Attachment' });

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      for (let j = 0; j < 4; j++) {
        if (fields[i].type === 'checkbox') {
          await dashboard.grid.cell.checkbox.verifyChecked({
            index: j,
            columnHeader: fields[i].title,
          });
        } else {
          await dashboard.grid.cell.attachment.verifyFileCount({
            index: j,
            columnHeader: fields[i].title,
            count: 1,
          });
        }
      }
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 4 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(+updatedRecords[i]['Checkbox']).toBe(1);
        expect(updatedRecords[i]['Attachment'][0].title).toBe('1.json');
        expect(updatedRecords[i]['Attachment'][0].mimetype).toBe('application/json');
      }
    }
  });
});

test.describe('Fill Handle', () => {
  test.beforeEach(async ({ page }) => {
    await beforeEachInit({ page, tableType: 'dateTimeBased' });
  });

  test('Date Time Based', async () => {
    const row0_date = await api.dbTableRow.read('noco', context.project.id, table.id, 1);
    const fields = [{ title: 'Date', value: row0_date['Date'], type: 'date' }];

    await dragDrop({ firstColumn: 'Date', lastColumn: 'Date' });

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      for (let j = 0; j < 4; j++) {
        await dashboard.grid.cell.date.verify({
          index: j,
          columnHeader: fields[i].title,
          date: fields[i].value,
        });
      }
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 4 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i]['Date']).toBe(fields[j].value);
      }
    }
  });
});
