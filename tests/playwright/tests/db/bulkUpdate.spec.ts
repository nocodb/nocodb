import { expect, test } from '@playwright/test';
import setup from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { Api } from 'nocodb-sdk';
import { createDemoTable } from '../../setup/demoTable';
import { BulkUpdatePage } from '../../pages/Dashboard/BulkUpdate';

test.describe('Bulk update', () => {
  let dashboard: DashboardPage;
  let bulkUpdateForm: BulkUpdatePage;
  let context: any;
  let api: Api<any>;
  let records: any[];
  let table;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    bulkUpdateForm = dashboard.bulkUpdateForm;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    table = await createDemoTable({ context, type: 'textBased', recordCnt: 50 });
    records = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 50 })).list;
    await page.reload();

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'textBased' });

    // Open bulk update form
    await dashboard.grid.updateAll();
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
    const fields = ['SingleLineText', 'Email', 'PhoneNumber', 'URL', 'MultiLineText'];
    const longText =
      'Long text. Long text. Long text. Long text. Long text. Long text. Long text. Long text. Long text. ';
    const fieldsFillText = ['SingleLineText', 'a@b.com', '987654321', 'https://www.google.com', longText];
    const fieldsFillType = ['text', 'text', 'text', 'text', 'longText'];

    // move all fields to active
    for (let i = 0; i < fields.length; i++) {
      await bulkUpdateForm.addField(0);
    }

    // fill all fields
    for (let i = 0; i < fields.length; i++) {
      await bulkUpdateForm.fillField({ columnTitle: fields[i], value: fieldsFillText[i], type: fieldsFillType[i] });
    }

    // save form
    await bulkUpdateForm.save({ awaitResponse: true });

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      await dashboard.grid.cell.verify({ index: 5, columnHeader: fields[i], value: fieldsFillText[i] });
    }

    // verify api response
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 50 })).list;
    for (let i = 0; i < records.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        expect(updatedRecords[i][fields[j]]).toEqual(fieldsFillText[j]);
      }
    }
  });
});

test.describe('Bulk update - Number based', () => {
  let dashboard: DashboardPage;
  let bulkUpdateForm: BulkUpdatePage;
  let context: any;
  let api: Api<any>;
  let records: any[];
  let table;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    bulkUpdateForm = dashboard.bulkUpdateForm;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    table = await createDemoTable({ context, type: 'numberBased', recordCnt: 50 });
    records = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 50 })).list;
    await page.reload();

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // Open bulk update form
    await dashboard.grid.updateAll();
  });

  test('Number based', async () => {
    const fields = ['Number', 'Decimal', 'Currency', 'Percent', 'Duration', 'Rating', 'Year', 'Time'];
    const fieldsFillText = ['1', '1.1', '1.1', '10', '16:40', '3', '2024', '10:10'];
    const fieldsFillType = ['text', 'text', 'text', 'text', 'text', 'rating', 'year', 'time'];

    // move all fields to active
    for (let i = 0; i < fields.length; i++) {
      await bulkUpdateForm.addField(0);
    }

    // fill all fields
    for (let i = 0; i < fields.length; i++) {
      await bulkUpdateForm.fillField({ columnTitle: fields[i], value: fieldsFillText[i], type: fieldsFillType[i] });
    }

    // save form
    await bulkUpdateForm.save({ awaitResponse: true });

    // verify data on grid
    for (let i = 0; i < fields.length; i++) {
      if (fieldsFillType[i] === 'rating') {
        await dashboard.grid.cell.rating.verify({ index: 5, columnHeader: fields[i], rating: +fieldsFillText[i] });
      } else if (fieldsFillType[i] === 'year') {
        await dashboard.grid.cell.year.verify({ index: 5, columnHeader: fields[i], value: +fieldsFillText[i] });
      } else if (fieldsFillType[i] === 'time') {
        await dashboard.grid.cell.time.verify({ index: 5, columnHeader: fields[i], value: fieldsFillText[i] });
      } else {
        await dashboard.grid.cell.verify({ index: 5, columnHeader: fields[i], value: fieldsFillText[i] });
      }
    }

    // verify api response
    // duration in seconds
    const APIResponse = [1, 1.1, 1.1, 10, 60000, 3, 2024, '10:10:00'];
    const updatedRecords = (await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 50 })).list;
    for (let i = 0; i < records.length; i++) {
      for (let j = 0; j < fields.length; j++) {
        if (fields[j] === 'Time') {
          expect(updatedRecords[i][fields[j]]).toContain(APIResponse[j]);
        } else {
          expect(+updatedRecords[i][fields[j]]).toEqual(APIResponse[j]);
        }
      }
    }
  });
});
