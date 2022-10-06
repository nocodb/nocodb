import { Page, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { GridPage } from '../pages/Grid';
import setup from '../setup';


test.describe.serial('Multi select', () => {
  let dashboard: DashboardPage, grid: GridPage;
  let context: any;

  test.beforeEach(async ({page}) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    await dashboard.createTable({ title: 'sheet1' });
  
    grid = new GridPage(page);
    await grid.column.create({ title: 'MultiSelect', type: 'MultiSelect' });
    await grid.addNewRow({index: 0, title: "Row 0"});
  })

  test('Select and clear options and rename options', async () => {
    await grid.cell.selectOption.select({index: 0, columnHeader: 'MultiSelect', option: 'Option 1', multiSelect: true});
    await grid.cell.selectOption.verify({index: 0, columnHeader: 'MultiSelect', option: 'Option 1', multiSelect: true});

    await grid.cell.selectOption.select({index: 0, columnHeader: 'MultiSelect', option: 'Option 2', multiSelect: true});
    await grid.cell.selectOption.verify({index: 0, columnHeader: 'MultiSelect', option: 'Option 2', multiSelect: true});

    await grid.addNewRow({index: 0, title: "Row 0"});
    await grid.cell.selectOption.select({index: 1, columnHeader: 'MultiSelect', option: 'Option 1', multiSelect: true});

    await grid.cell.selectOption.clear({index: 0, columnHeader: 'MultiSelect', multiSelect: true});
    await grid.cell.click({index: 0, columnHeader: 'MultiSelect'});

    await grid.column.selectOption.addOption({index: 2, option: 'Option 3', columnTitle: 'MultiSelect'});

    await grid.cell.selectOption.select({index: 0, columnHeader: 'MultiSelect', option: 'Option 3', multiSelect: true});
    await grid.cell.selectOption.verify({index: 0, columnHeader: 'MultiSelect', option: 'Option 3', multiSelect: true});

    await grid.column.selectOption.editOption({index: 2, columnTitle: 'MultiSelect', newOption: 'New Option 3'});
    await grid.cell.selectOption.verify({index: 0, columnHeader: 'MultiSelect', option: 'New Option 3', multiSelect: true});

    await grid.cell.selectOption.verifyOptions({index: 0, columnHeader: 'MultiSelect', options: ['Option 1', 'Option 2', 'New Option 3']});

    await grid.deleteRow(0);
    await grid.deleteRow(0);
    await grid.verifyRowDoesNotExist({index: 0});
  });

  test('Remove a option, reorder option and delete the column', async () => {
    await grid.cell.selectOption.select({index: 0, columnHeader: 'MultiSelect', option: 'Option 1', multiSelect: true});
    await grid.column.selectOption.addOption({index: 2, option: 'Option 3', columnTitle: 'MultiSelect'});

    await grid.cell.selectOption.select({index: 0, columnHeader: 'MultiSelect', option: 'Option 3', multiSelect: true});
    await grid.cell.selectOption.verify({index: 0, columnHeader: 'MultiSelect', option: 'Option 3', multiSelect: true});

    await grid.column.selectOption.deleteOption({index: 2, columnTitle: 'MultiSelect'});
    await grid.cell.selectOption.verifyNoOptionsSelected({index: 0, columnHeader: 'MultiSelect'});

    await grid.column.selectOption.reorderOption({sourceOption: "Option 1", columnTitle: 'MultiSelect', destinationOption: "Option 2"});
    await grid.cell.selectOption.verifyOptions({index: 0, columnHeader: 'MultiSelect', options: ['Option 2', 'Option 1']});

    await grid.column.delete({title: 'MultiSelect'});
  });

});
