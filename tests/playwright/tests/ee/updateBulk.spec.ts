import { expect, test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { Api } from 'nocodb-sdk';
import { createDemoTable } from '../../setup/demoTable';
import { BulkUpdatePage } from '../../pages/Dashboard/BulkUpdate';
// import { AccountLicensePage } from '../../pages/Account/License';
// import { AccountPage } from '../../pages/Account';

async function updateBulkFields(bulkUpdateForm: BulkUpdatePage, fields) {
  // move all fields to active
  for (let i = 0; i < fields.length; i++) {
    await bulkUpdateForm.addField(0);
  }

  // fill all fields
  for (let i = 0; i < fields.length; i++) {
    await bulkUpdateForm.fillField({ columnTitle: fields[i].title, value: fields[i].value, type: fields[i].type });
  }

  // save form
  await bulkUpdateForm.save({ awaitResponse: true });
}

async function beforeEachInit({ page, tableType }: { page: any; tableType: string }) {
  const context = await setup({ page, isEmptyProject: true, isSuperUser: true });
  const dashboard = new DashboardPage(page, context.base);
  const bulkUpdateForm = dashboard.bulkUpdateForm;

  const api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });

  const table = await createDemoTable({ context, type: tableType, recordCnt: 50 });

  // For tables created via API to appear
  await dashboard.rootPage.reload();

  await dashboard.treeView.openTable({ title: tableType });

  // Open bulk update form
  await dashboard.grid.updateAll();

  return { bulkUpdateForm, dashboard, context, api, table };
}

test.describe('Bulk update 0', () => {
  // TODO: @DarkPhoenix2704 Update Tests
  test.skip();
  let bulkUpdateForm: BulkUpdatePage;
  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;
  let table;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page, tableType: 'textBased' });
    bulkUpdateForm = initRsp.bulkUpdateForm;
    dashboard = initRsp.dashboard;
    context = initRsp.context;
    api = initRsp.api;
    table = initRsp.table;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('General- Click to add & remove', async () => {
    let inactiveColumns = await bulkUpdateForm.getInactiveColumns();
    expect(inactiveColumns).toEqual(['SingleLineText', 'MultiLineText', 'Email', 'PhoneNumber', 'URL']);

    let activeColumns = await bulkUpdateForm.getActiveColumns();
    expect(activeColumns).toEqual([]);

    await bulkUpdateForm.addField(0);
    await bulkUpdateForm.addField(0);

    inactiveColumns = await bulkUpdateForm.getInactiveColumns();
    expect(inactiveColumns).toEqual(['Email', 'PhoneNumber', 'URL']);

    activeColumns = await bulkUpdateForm.getActiveColumns();
    expect(activeColumns).toEqual(['SingleLineText', 'MultiLineText']);
  });

  test('General- Drag drop', async () => {
    const src = await bulkUpdateForm.getInactiveColumn(0);
    const dst = await bulkUpdateForm.form;

    await src.dragTo(dst);
    expect(await bulkUpdateForm.getActiveColumns()).toEqual(['SingleLineText']);
    expect(await bulkUpdateForm.getInactiveColumns()).toEqual(['MultiLineText', 'Email', 'PhoneNumber', 'URL']);

    const src2 = await bulkUpdateForm.getActiveColumn(0);
    const dst2 = await bulkUpdateForm.columnsDrawer;

    await src2.dragTo(dst2);
    expect(await bulkUpdateForm.getActiveColumns()).toEqual([]);
    expect(await bulkUpdateForm.getInactiveColumns()).toEqual([
      'SingleLineText',
      'MultiLineText',
      'Email',
      'PhoneNumber',
      'URL',
    ]);
  });

  test('Text based', async () => {
    const fields = [
      { title: 'SingleLineText', value: 'SingleLineText', type: 'text' },
      { title: 'Email', value: 'a@b.com', type: 'text' },
      { title: 'PhoneNumber', value: '987654321', type: 'text' },
      { title: 'URL', value: 'https://www.google.com', type: 'text' },
      {
        title: 'MultiLineText',
        value: 'Long text. Long text. Long text. Long text. Long text. Long text. Long text. Long text. Long text.',
        type: 'longText',
      },
    ];

    await updateBulkFields(bulkUpdateForm, fields);

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      await dashboard.grid.cell.verify({ index: 5, columnHeader: fields[i].title, value: fields[i].value });
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 50 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i][fields[j].title]).toEqual(fields[j].value);
      }
    }
  });
});

test.describe('Bulk update 1', () => {
  // TODO: @DarkPhoenix2704 Update Tests
  test.skip();
  let bulkUpdateForm: BulkUpdatePage;
  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;
  let table;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page, tableType: 'numberBased' });
    bulkUpdateForm = initRsp.bulkUpdateForm;
    dashboard = initRsp.dashboard;
    context = initRsp.context;
    api = initRsp.api;
    table = initRsp.table;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Number based', async () => {
    const fields = [
      { title: 'Number', value: '1', type: 'text' },
      { title: 'Decimal', value: '1.1', type: 'text' },
      { title: 'Currency', value: '1.1', type: 'text' },
      { title: 'Percent', value: '10', type: 'text' },
      { title: 'Duration', value: '16:40', type: 'text' },
      { title: 'Rating', value: '3', type: 'rating' },
      { title: 'Year', value: '2024', type: 'year' },
      { title: 'Time', value: '10:10', type: 'time' },
    ];

    await updateBulkFields(bulkUpdateForm, fields);

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'rating') {
        await dashboard.grid.cell.rating.verify({ index: 5, columnHeader: fields[i].title, rating: +fields[i].value });
      } else if (fields[i].type === 'year') {
        await dashboard.grid.cell.year.verify({ index: 5, columnHeader: fields[i].title, value: +fields[i].value });
      } else if (fields[i].type === 'time') {
        await dashboard.grid.cell.time.verify({ index: 5, columnHeader: fields[i].title, value: fields[i].value });
      } else {
        await dashboard.grid.cell.verify({ index: 5, columnHeader: fields[i].title, value: fields[i].value });
      }
    }

    // verify api response
    // duration in seconds
    const APIResponse = [1, 1.1, 1.1, 10, 60000, 3, 2024, '10:10:00'];
    const updatedRecords = (await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 50 })).list;
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

test.describe('Bulk update 2', () => {
  // TODO: @DarkPhoenix2704 Update Tests
  test.skip();
  let bulkUpdateForm: BulkUpdatePage;
  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;
  let table;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page, tableType: 'selectBased' });
    bulkUpdateForm = initRsp.bulkUpdateForm;
    dashboard = initRsp.dashboard;
    context = initRsp.context;
    api = initRsp.api;
    table = initRsp.table;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Select based', async () => {
    const fields = [
      { title: 'SingleSelect', value: 'jan', type: 'singleSelect' },
      { title: 'MultiSelect', value: 'jan,feb,mar', type: 'multiSelect' },
    ];

    await updateBulkFields(bulkUpdateForm, fields);

    // verify data on grid
    const displayOptions = ['jan', 'feb', 'mar'];
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'singleSelect') {
        await dashboard.grid.cell.selectOption.verify({
          index: 5,
          columnHeader: fields[i].title,
          option: fields[i].value,
        });
      } else {
        await dashboard.grid.cell.selectOption.verifyOptions({
          index: 5,
          columnHeader: fields[i].title,
          options: displayOptions,
        });
      }
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 50 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i][fields[j].title]).toContain(fields[j].value);
      }
    }
  });
});

test.describe('Bulk update 3', () => {
  // TODO: @DarkPhoenix2704 Update Tests
  test.skip();
  let bulkUpdateForm: BulkUpdatePage;
  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;
  let table;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page, tableType: 'miscellaneous' });
    bulkUpdateForm = initRsp.bulkUpdateForm;
    dashboard = initRsp.dashboard;
    context = initRsp.context;
    api = initRsp.api;
    table = initRsp.table;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Miscellaneous (Checkbox)', async () => {
    const fields = [{ title: 'Checkbox', value: 'true', type: 'checkbox' }];

    await updateBulkFields(bulkUpdateForm, fields);

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'checkbox') {
        await dashboard.grid.cell.checkbox.verifyChecked({
          index: 5,
          columnHeader: fields[i].title,
        });
      } /* else {
        await dashboard.grid.cell.attachment.verifyFileCount({
          index: 5,
          columnHeader: fields[i].title,
          count: 1,
        });
      } */
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 50 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(+updatedRecords[i]['Checkbox']).toBe(1);
        /* expect(updatedRecords[i]['Attachment'][0].title).toBe('1.json');
        expect(updatedRecords[i]['Attachment'][0].mimetype).toBe('application/json'); */
      }
    }
  });
});

test.describe('Bulk update 4', () => {
  // TODO: @DarkPhoenix2704 Update Tests
  test.skip();
  let bulkUpdateForm: BulkUpdatePage;
  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;
  let table;

  test.beforeEach(async ({ page }) => {
    const initRsp = await beforeEachInit({ page, tableType: 'dateTimeBased' });
    bulkUpdateForm = initRsp.bulkUpdateForm;
    dashboard = initRsp.dashboard;
    context = initRsp.context;
    api = initRsp.api;
    table = initRsp.table;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Date Time Based', async () => {
    const fields = [{ title: 'Date', value: '2024-08-04', type: 'date' }];

    await updateBulkFields(bulkUpdateForm, fields);

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      await dashboard.grid.cell.date.verify({
        index: 5,
        columnHeader: fields[i].title,
        date: fields[i].value,
      });
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 50 })).list;
    for (let i = 0; i < updatedRecords.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i]['Date']).toBe(fields[j].value);
      }
    }
  });
});
