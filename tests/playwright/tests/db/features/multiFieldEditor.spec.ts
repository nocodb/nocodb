import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FieldsPage } from '../../../pages/Dashboard/Details/FieldsPage';
import { getTextExcludeIconText } from '../../utils/general';
import { UITypes } from 'nocodb-sdk';

test.describe('Multi Field Editor', () => {
  let dashboard: DashboardPage, fields: FieldsPage;
  let context: any;
  const defaultFieldName = 'Multi Field Editor';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    fields = dashboard.details.fields;

    await dashboard.treeView.createTable({ title: 'Multifield', baseTitle: context.base.title });
    await openMultiFieldOfATable();
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

  const searchAndVerifyFields = async ({ searchQuery, fieldList }: { searchQuery: string; fieldList: string[] }) => {
    await fields.searchFieldInput.fill(searchQuery);

    const allFields = await fields.getAllFieldText();
    expect(allFields).toEqual(fieldList.filter(field => field.toLowerCase().includes(searchQuery.toLowerCase())));
  };

  test('Add New field, update and reset ', async () => {
    // Add New Field
    await fields.createOrUpdate({ title: 'Name' });

    // Update Field title
    await fields.getField({ title: 'Name' }).click();
    await fields.createOrUpdate({ title: 'Updated Name', isUpdateMode: true });

    // verify grid column header
    const fieldsText = await fields.getAllFieldText();
    await verifyGridColumnHeaders({ fields: fieldsText });

    // add new fields then reset changes and verify
    await fields.createOrUpdate({ title: 'field to reset', saveChanges: false });
    await fields.createOrUpdate({ title: 'Random', saveChanges: false });
    await fields.resetFieldChangesButton.click();

    // verify with old fields
    await verifyGridColumnHeaders({ fields: fieldsText });
  });

  test('Field operations: CopyId, Duplicate, InsertAbove, InsertBelow, Hide', async () => {
    // Add New Field
    await fields.createOrUpdate({ title: defaultFieldName });

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

  test('Search field and verify', async () => {
    const fieldList = ['Single Line Text', 'Long text', 'Rich text', 'Number', 'Percentage'];

    for (const field of fieldList) {
      await fields.createOrUpdate({ title: field, saveChanges: false });
    }
    await fields.saveChanges();

    let searchQuery = 'text';
    await searchAndVerifyFields({
      searchQuery,
      fieldList,
    });

    searchQuery = 'Rich text';
    await searchAndVerifyFields({
      searchQuery,
      fieldList,
    });
  });

  test('Field Reorder and verify', async () => {
    // default order: ['Title', 'Single Line Text', 'Long Text', 'Number', 'Percent','Links']
    const fieldList = [
      {
        title: 'Single Line Text',
        type: UITypes.SingleLineText,
      },
      {
        title: 'Long Text',
        type: UITypes.LongText,
      },
      {
        title: 'Number',
        type: UITypes.Number,
      },
      {
        title: 'Percent',
        type: UITypes.Percent,
      },
      {
        title: 'Links',
        type: UITypes.Links,
        relationType: 'Has Many',
        childTable: 'Multifield',
      },
    ];

    for (const field of fieldList) {
      await fields.createOrUpdate({ ...field, saveChanges: false });
    }
    await fields.saveChanges();
    // updated order : ['Title', 'Long Text','Single Line Text', 'Number', 'Percent','Links']
    await fields.getField({ title: fieldList[0].title }).dragTo(fields.getField({ title: fieldList[1].title }));
    await expect(fields.getField({ title: fieldList[0].title })).toContainText('Updated field');

    // updated order : ['Title', 'Long Text','Single Line Text', 'Number','Links', 'Percent']
    await fields.getField({ title: fieldList[4].title }).dragTo(fields.getField({ title: fieldList[3].title }));
    await expect(fields.getField({ title: fieldList[4].title })).toContainText('Updated field');

    await fields.saveChanges();
    const fieldsText = await fields.getAllFieldText();
    const expectedFieldText = ['Title', 'Long Text', 'Single Line Text', 'Number', 'Links', 'Percent'];

    expect(fieldsText).toEqual(expectedFieldText);

    await verifyGridColumnHeaders({ fields: expectedFieldText });
  });
});
