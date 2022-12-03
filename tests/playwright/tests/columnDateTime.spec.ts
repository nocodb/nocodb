import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';

// Storing one additional dummy value "10" at end of every input array
// this will trigger update to previously committed data
const dateTimeData = [
  {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    date: '2022-12-12',
    hour: '10',
    minute: '20',
    output: '2022-12-12 10:20',
  },
  {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    date: '2022-12-12',
    hour: '20',
    minute: '30',
    second: '40',
    output: '2022-12-12 20:30:40',
  },
  {
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm',
    date: '2022/12/12',
    hour: '10',
    minute: '20',
    output: '2022/12/12 10:20',
  },
  {
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm:ss',
    date: '2022/12/12',
    hour: '5',
    minute: '30',
    second: '40',
    output: '2022/12/12 05:30:40',
  },
  {
    dateFormat: 'DD-MM-YYYY',
    timeFormat: 'HH:mm',
    date: '25-11-2022',
    hour: '3',
    minute: '20',
    output: '12-12-2022 03:20',
  },
  {
    dateFormat: 'DD-MM-YYYY',
    timeFormat: 'HH:mm:ss',
    date: '25-11-2022',
    hour: '2',
    minute: '30',
    second: '40',
    output: '25-11-2022 02:30:40',
  },
];

test.describe('DateTime Column', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test.only('Create DateTime Column', async () => {
    await dashboard.treeView.createTable({ title: 'test_datetime' });
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
      });
      await dashboard.grid.cell.dateTime.close();

      await dashboard.grid.cell.verify({
        index: 0,
        columnHeader: 'NC_DATETIME_0',
        value: dateTimeData[i].output,
      });
    }
  });
});
