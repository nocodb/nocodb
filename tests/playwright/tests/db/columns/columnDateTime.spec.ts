import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

const dateTimeData = [
  {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    date: '2022-12-12',
    hour: 10,
    minute: 20,
    output: '2022-12-12 10:20',
  },
  {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    date: '2022-12-11',
    hour: 20,
    minute: 30,
    second: 40,
    output: '2022-12-11 20:30:40',
  },
  {
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm',
    date: '2022-12-13',
    hour: 10,
    minute: 20,
    output: '2022/12/13 10:20',
  },
  {
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm:ss',
    date: '2022-12-14',
    hour: 5,
    minute: 30,
    second: 40,
    output: '2022/12/14 05:30:40',
  },
  {
    dateFormat: 'DD-MM-YYYY',
    timeFormat: 'HH:mm',
    date: '2022-12-10',
    hour: 4,
    minute: 30,
    output: '10-12-2022 04:30',
    selectFromPicker: true,
  },
  {
    dateFormat: 'DD-MM-YYYY',
    timeFormat: 'HH:mm:ss',
    date: '2022-12-26',
    hour: 2,
    minute: 30,
    second: 40,
    output: '26-12-2022 02:30:40',
  },
];

const dateData = [
  {
    dateFormat: 'YYYY-MM-DD',
    date: '2022-12-12',
    output: '2022-12-12',
  },
  {
    dateFormat: 'YYYY/MM/DD',
    date: '2022-12-13',
    output: '2022/12/13',
  },
  {
    dateFormat: 'DD-MM-YYYY',
    date: '2022-12-10',
    output: '10-12-2022',
  },
  {
    dateFormat: 'YYYY-MM',
    date: '2022-12-26',
    output: '2022-12',
  },
];

test.describe('DateTime Column', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create DateTime Column', async () => {
    await dashboard.treeView.createTable({ title: 'test_datetime', baseTitle: context.base.title });
    // Create DateTime column
    await dashboard.grid.column.create({
      title: 'NC_DATETIME_0',
      type: 'DateTime',
      dateFormat: dateTimeData[0].dateFormat,
      timeFormat: dateTimeData[0].timeFormat,
    });

    for (let i = 0; i < dateTimeData.length; i++) {
      // Edit DateTime column
      await dashboard.grid.column.openEdit({
        title: 'NC_DATETIME_0',
        type: 'DateTime',
        dateFormat: dateTimeData[i].dateFormat,
        timeFormat: dateTimeData[i].timeFormat,
      });

      await dashboard.grid.column.save({ isUpdated: true });

      await dashboard.grid.cell.dateTime.open({
        index: 0,
        columnHeader: 'NC_DATETIME_0',
      });

      await dashboard.grid.cell.dateTime.selectDate({
        date: dateTimeData[i].date,
        index: 0,
        columnHeader: 'NC_DATETIME_0',
      });

      await dashboard.grid.cell.dateTime.selectTime({
        index: 0,
        columnHeader: 'NC_DATETIME_0',
        hour: dateTimeData[i].hour,
        minute: dateTimeData[i].minute,
        second: dateTimeData[i].second,
        fillValue: dateTimeData[i].output.split(' ')[1].trim(),
        selectFromPicker: !!dateTimeData[i].selectFromPicker,
      });

      await dashboard.grid.cell.verifyDateCell({
        index: 0,
        columnHeader: 'NC_DATETIME_0',
        value: dateTimeData[i].output,
      });
    }
  });
});

test.describe('Date Column', () => {
  // if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create Date Column', async () => {
    await dashboard.treeView.createTable({ title: 'test_date', baseTitle: context.base.title });
    // Create DateTime column
    await dashboard.grid.column.create({
      title: 'NC_DATE_0',
      type: 'Date',
      dateFormat: dateData[0].dateFormat,
    });

    for (let i = 0; i < dateData.length; i++) {
      // Edit DateTime column
      await dashboard.grid.column.openEdit({
        title: 'NC_DATE_0',
        type: 'Date',
        dateFormat: dateData[i].dateFormat,
      });

      await dashboard.grid.column.save({ isUpdated: true });

      await dashboard.grid.cell.dateTime.open({
        index: 0,
        columnHeader: 'NC_DATE_0',
      });

      await dashboard.grid.cell.dateTime.selectDate({
        date: dateData[i].date,
        skipDate: dateData[i].dateFormat === 'YYYY-MM',
        index: 0,
        columnHeader: 'NC_DATE_0',
      });

      await dashboard.grid.cell.verifyDateCell({
        index: 0,
        columnHeader: 'NC_DATE_0',
        value: dateData[i].output,
      });
    }
  });
});
