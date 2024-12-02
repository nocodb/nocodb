import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

// Storing one additional dummy value "10" at end of every input array
// this will trigger update to previously committed data
const durationData = [
  {
    format: 'h:mm',
    input: ['1:30', '30', '60', '80', '12:34', '15:130', '123123', '10'],
    output: ['01:30', '00:30', '01:00', '01:20', '12:34', '17:10', '2052:03'],
  },
  {
    format: 'h:mm:ss',
    input: ['11:22:33', '1234', '50', '1:1111', '1:11:1111', '15:130', '123123', '10'],
    output: ['11:22:33', '00:20:34', '00:00:50', '00:19:31', '01:29:31', '00:17:10', '34:12:03'],
  },
  {
    format: 'h:mm:ss.s',
    input: ['1234', '12:34', '12:34:56', '12:34:999', '12:999:56', '12:34:56.12', '12:34:56.199', '10'],
    output: ['00:20:34.0', '00:12:34.0', '12:34:56.0', '12:50:39.0', '28:39:56.0', '12:34:56.1', '12:34:56.2'],
  },
  {
    format: 'h:mm:ss.ss',
    input: ['1234', '12:34', '12:34:56', '12:34:999', '12:999:56', '12:34:56.12', '12:34:56.199', '10'],
    output: ['00:20:34.00', '00:12:34.00', '12:34:56.00', '12:50:39.00', '28:39:56.00', '12:34:56.12', '12:34:56.20'],
  },
  {
    format: 'h:mm:ss.sss',
    input: ['1234', '12:34', '12:34:56', '12:34:999', '12:999:56', '12:34:56.12', '12:34:56.199', '10'],
    output: [
      '00:20:34.000',
      '00:12:34.000',
      '12:34:56.000',
      '12:50:39.000',
      '28:39:56.000',
      '12:34:56.012',
      '12:34:56.199',
    ],
  },
];

test.describe('Duration column', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.skip('Create duration column', async () => {
    await dashboard.treeView.createTable({ title: 'tablex', baseTitle: context.base.title });
    // Create duration column
    await dashboard.grid.column.create({
      title: 'NC_DURATION_0',
      type: 'Duration',
      format: durationData[0].format,
    });
    for (let i = 0; i < 8; i++) {
      await dashboard.grid.addNewRow({
        index: i,
        columnHeader: 'NC_DURATION_0',
        value: i.toString(),
        networkValidation: false,
      });
    }

    for (let i = 0; i < durationData.length; i++) {
      // Edit duration column
      await dashboard.grid.column.openEdit({
        title: 'NC_DURATION_0',
        type: 'Duration',
        format: durationData[i].format,
      });
      await dashboard.grid.column.save({ isUpdated: true });
      for (let j = 0; j < durationData[i].input.length; j++) {
        await dashboard.grid.editRow({
          index: j,
          columnHeader: 'NC_DURATION_0',
          value: durationData[i].input[j],
          networkValidation: false,
        });
      }
      for (let j = 0; j < durationData[i].output.length; j++) {
        await dashboard.grid.cell.verify({
          index: j,
          columnHeader: 'NC_DURATION_0',
          value: durationData[i].output[j],
        });
      }
    }
  });
});
