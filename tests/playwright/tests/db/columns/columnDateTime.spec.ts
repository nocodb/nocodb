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
      });

      await dashboard.grid.cell.dateTime.selectTime({
        hour: dateTimeData[i].hour,
        minute: dateTimeData[i].minute,
        second: dateTimeData[i].second,
      });

      await dashboard.grid.cell.dateTime.save();

      await dashboard.grid.cell.verifyDateCell({
        index: 0,
        columnHeader: 'NC_DATETIME_0',
        value: dateTimeData[i].output,
      });
    }
  });
});
