import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { FieldsPage } from '../../../pages/Dashboard/Details/FieldsPage';

test.describe('Multi Field Editor', () => {
  let dashboard: DashboardPage, grid: GridPage, fields: FieldsPage;
  let context: any;
  const defaultFieldName = 'Multi Field Editor';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
    fields = dashboard.details.fields;

    await dashboard.treeView.createTable({ title: 'Multifield', baseTitle: context.base.title });
    await dashboard.grid.topbar.openDetailedTab();
    await dashboard.details.clickFieldsTab();

    // Add New Field
    await fields.createOrUpdate({ title: defaultFieldName });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  const openMultiFieldOfATable = async (tableName: string) => {
    await dashboard.treeView.openTable({ title: tableName });
    await dashboard.grid.topbar.openDetailedTab();
    await dashboard.details.clickRelationsTab();
  };

  test('Add New field and update', async () => {
    // Add New Field
    await fields.createOrUpdate({ title: 'Name' });

    // Update Field title
    await fields.getField({ title: 'Name' }).click();
    await fields.createOrUpdate({ title: 'Updated Name', isUpdateMode: true });
  });

  test('Field action menu: CopyId, Duplicate, InsertAbove, InsertBelow', async () => {
    await fields.createOrUpdate({ title: 'Above Inserted Field', insertAboveColumnTitle: defaultFieldName });
    await fields.createOrUpdate({ title: 'Below Inserted Field', insertBelowColumnTitle: defaultFieldName });
  });
});
