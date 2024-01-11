import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { FieldsPage } from '../../../pages/Dashboard/Details/FieldsPage';
import { getTextExcludeIconText } from '../../utils/general';

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
    await openMultiFieldOfATable();

    // Add New Field
    await fields.createOrUpdate({ title: defaultFieldName });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function openMultiFieldOfATable() {
    await dashboard.grid.topbar.openDetailedTab();
    await dashboard.details.clickFieldsTab();
  }

  const verifyGridColumnHeaders = async ({ fields = [] }: { fields: string[] }) => {
    await dashboard.grid.topbar.openDataTab();

    const locator = dashboard.grid.get().locator(`th`);
    const count = await locator.count();

    // exclude first checkbox and last add new column
    expect(count - 2).toBe(fields.length);

    for (let i = 1; i < count - 1; i++) {
      const header = locator.nth(i);
      const text = await getTextExcludeIconText(header);
      expect(text).toBe(fields[i - 1]);
    }

    await openMultiFieldOfATable();
  };

  test('Add New field and update', async () => {
    // Add New Field
    await fields.createOrUpdate({ title: 'Name' });

    // Update Field title
    await fields.getField({ title: 'Name' }).click();
    await fields.createOrUpdate({ title: 'Updated Name', isUpdateMode: true });
  });

  test.only('Field operations: CopyId, Duplicate, InsertAbove, InsertBelow, Hide', async () => {
    // copy-id and verify
    const fieldId = await fields.getFieldId({ title: defaultFieldName });
    await fields.selectFieldAction({ title: defaultFieldName, action: 'copy-id' });
    expect(fieldId).toBe(await dashboard.getClipboardText());

    // duplicate and verify
    await fields.selectFieldAction({ title: defaultFieldName, action: 'duplicate' });
    await fields.saveChanges();

    let fieldsText = await fields.getAllFieldText();
    expect(fieldsText[fieldsText.findIndex(field => field === defaultFieldName) + 1]).toBe(`${defaultFieldName}_copy`);

    // insert and verify
    await fields.createOrUpdate({ title: 'Above Inserted Field', insertAboveColumnTitle: defaultFieldName });
    await fields.createOrUpdate({ title: 'Below Inserted Field', insertBelowColumnTitle: defaultFieldName });

    // delete and verify
    await fields.selectFieldAction({ title: `${defaultFieldName}_copy`, action: 'delete' });
    await fields.saveChanges();

    fieldsText = await fields.getAllFieldText();
    expect(fieldsText.findIndex(field => field === `${defaultFieldName}_copy`)).toBe(-1);

    // verify grid column header
    await verifyGridColumnHeaders({ fields: fieldsText });

    // Hide field and verify grid column header
    await (await fields.getFieldVisibilityCheckbox({ title: defaultFieldName })).click();
    await fields.saveChanges();

    await verifyGridColumnHeaders({ fields: fieldsText.filter(field => field !== defaultFieldName) });
  });
});
