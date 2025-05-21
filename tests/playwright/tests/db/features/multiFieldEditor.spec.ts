import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { FieldsPage } from '../../../pages/Dashboard/Details/FieldsPage';
import { getTextExcludeIconText } from '../../utils/general';
import { UITypes } from 'nocodb-sdk';
import { enableQuickRun } from '../../../setup/db';

const allFieldList = [
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
    title: 'Decimal',
    type: UITypes.Decimal,
  },
  {
    title: 'Attachment',
    type: UITypes.Attachment,
  },
  {
    title: 'Checkbox',
    type: UITypes.Checkbox,
  },
  {
    title: 'MultiSelect',
    type: UITypes.MultiSelect,
  },
  {
    title: 'SingleSelect',
    type: UITypes.SingleSelect,
  },
  {
    title: 'Date',
    type: UITypes.Date,
  },
  {
    title: 'DateTime',
    type: UITypes.DateTime,
  },
  {
    title: 'Year',
    type: UITypes.Year,
  },
  {
    title: 'Time',
    type: UITypes.Time,
  },
  {
    title: 'PhoneNumber',
    type: UITypes.PhoneNumber,
  },
  {
    title: 'Email',
    type: UITypes.Email,
  },
  {
    title: 'URL',
    type: UITypes.URL,
  },
  {
    title: 'Currency',
    type: UITypes.Currency,
  },
  {
    title: 'Percent',
    type: UITypes.Percent,
  },
  {
    title: 'Duration',
    type: UITypes.Duration,
  },
  {
    title: 'Rating',
    type: UITypes.Rating,
  },
  {
    title: 'Formula',
    type: UITypes.Formula,
    formula: 'LEN({Title})',
  },
  {
    title: 'QrCode',
    type: UITypes.QrCode,
    qrCodeValueColumnTitle: 'Title',
  },
  {
    title: 'Barcode',
    type: UITypes.Barcode,
    barcodeValueColumnTitle: 'Title',
  },
  {
    title: 'Geometry',
    type: UITypes.Geometry,
  },
  {
    title: 'JSON',
    type: UITypes.JSON,
  },
  {
    title: 'User',
    type: UITypes.User,
  },
  {
    title: 'Links',
    type: UITypes.Links,
    relationType: 'Has Many',
    childTable: 'Multifield',
  },
];

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

  async function toggleShowSystemFieldsFromDataTab() {
    await dashboard.grid.topbar.openDataTab();
    await dashboard.grid.toolbar.fields.toggleShowSystemFields();
    await openMultiFieldOfATable();
  }

  const verifyGridColumnHeaders = async ({ fields = [] }: { fields: string[] }) => {
    await dashboard.grid.topbar.openDataTab();

    const locator = dashboard.grid.get().locator('th.nc-grid-column-header');

    await locator.first().waitFor({ state: 'visible' });

    const count = await locator.count();

    // exclude first checkbox and last add new column
    expect(count).toBe(fields.length);

    for (let i = 0; i < count; i++) {
      const header = locator.nth(i);
      const text = await getTextExcludeIconText(header);
      expect(text).toBe(fields[i]);
    }

    await openMultiFieldOfATable();
  };

  const searchAndVerifyFields = async ({ searchQuery, fieldList }: { searchQuery: string; fieldList: string[] }) => {
    await fields.searchFieldInput.fill(searchQuery);

    const allFields = await fields.getAllFieldText();
    expect(allFields).toEqual(
      searchQuery ? fieldList.filter(field => field.toLowerCase().includes(searchQuery.toLowerCase())) : fieldList
    );
  };

  test('Verify system fields listed, Add New field, update & Restore, reset', async () => {
    //Verify system fields are not listed
    let fieldsText = await fields.getAllFieldText();
    expect(fieldsText.length).toBe(1);

    //Verify system fields are listed
    await toggleShowSystemFieldsFromDataTab();
    fieldsText = await fields.getAllFieldText();
    await toggleShowSystemFieldsFromDataTab();
    expect(fieldsText.length).toBe(4);

    // Add New Field
    await fields.createOrUpdate({ title: 'Name', saveChanges: false });
    await expect(fields.getField({ title: 'Name' })).toContainText('New field');
    await fields.saveChanges();

    // Update Field title
    await fields.getField({ title: 'Name' }).click();
    await fields.createOrUpdate({ title: 'Updated Name', saveChanges: false, isUpdateMode: true });
    await expect(fields.getField({ title: 'Updated Name' })).toContainText('Updated field');
    await fields.saveChanges();

    // Update and restore field changes
    await fields.getField({ title: 'Updated Name' }).click();
    await fields.createOrUpdate({ title: 'Updated Name to restore', saveChanges: false, isUpdateMode: true });
    await fields.clickRestoreField({ title: 'Updated Name to restore' });

    // verify grid column header
    fieldsText = await fields.getAllFieldText();
    expect(fieldsText).toEqual(['Title', 'Updated Name']);
    await verifyGridColumnHeaders({ fields: fieldsText });

    // add new fields then reset changes and verify
    await fields.createOrUpdate({ title: 'field to reset', saveChanges: false });
    await fields.createOrUpdate({ title: 'Random', saveChanges: false });
    await fields.resetFieldChangesButton.click();

    // verify with old fields
    await verifyGridColumnHeaders({ fields: fieldsText });
  });

  // Todo: remove `skip`, if `optimized dependencies changed. reloading` issue is fixed
  test.skip('Add all fields and check status on clicking each field', async () => {
    // Add all fields, verify status and save
    for (const field of allFieldList) {
      await fields.createOrUpdate({ ...field, saveChanges: false });
      await expect(fields.getField({ title: field.title })).toContainText('New field');
      await fields.saveChanges();
    }
    let fieldsText = await fields.getAllFieldText();

    // verify all newly added field and its order
    expect(fieldsText).toEqual(['Title', ...allFieldList.map(field => field.title)]);

    // click on each field and check status
    fieldsText = await fields.getAllFieldText();
    for (const title of fieldsText) {
      await fields.getField({ title }).click();
      await expect(fields.getField({ title })).not.toContainText(['New field', 'Updated field']);
    }
  });

  test('Field operations: CopyId, Duplicate, InsertAbove, InsertBelow, Delete, Hide', async () => {
    if (enableQuickRun()) test.skip();
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
    expect(fieldsText[fieldsText.findIndex(field => field === defaultFieldName) + 1]).toBe(`${defaultFieldName} copy`);

    // insert and verify
    await fields.createOrUpdate({ title: 'Above Inserted Field', insertAboveColumnTitle: defaultFieldName });
    await fields.createOrUpdate({ title: 'Below Inserted Field', insertBelowColumnTitle: defaultFieldName });

    // delete and verify
    await fields.selectFieldAction({ title: `${defaultFieldName} copy`, action: 'delete' });
    await expect(fields.getField({ title: `${defaultFieldName} copy` })).toContainText('Deleted field');

    await fields.saveChanges();

    fieldsText = await fields.getAllFieldText();
    expect(!fieldsText.includes(`${defaultFieldName} copy`)).toBeTruthy();

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
      fieldList: ['Title', ...fieldList],
    });

    // clear search and verify
    await fields.clearSearch();
    await searchAndVerifyFields({
      searchQuery: '',
      fieldList: ['Title', ...fieldList],
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

  test('Keyboard shortcuts: add new field, save and delete', async () => {
    // add new field
    await dashboard.rootPage.keyboard.press('Alt+C');

    // verify field is added and has `New field` status
    let fieldsText = await fields.getAllFieldText();
    await expect(fields.getField({ title: fieldsText[fieldsText.length - 1] })).toContainText('New field');

    // update title
    await fields.createOrUpdate({ title: defaultFieldName, isUpdateMode: true });

    // save the changes
    await dashboard.rootPage.keyboard.press((await dashboard.isMacOs()) ? 'Meta+S' : 'Control+S');
    await dashboard.rootPage.waitForTimeout(500);

    // verify result
    fieldsText = await fields.getAllFieldText();
    expect(fieldsText).toEqual(['Title', defaultFieldName]);

    // delete field
    await fields.getField({ title: defaultFieldName }).click();
    await dashboard.rootPage.keyboard.press((await dashboard.isMacOs()) ? 'Meta+Delete' : 'Delete');
    await expect(fields.getField({ title: defaultFieldName })).toContainText('Deleted field');

    // save the changes
    await dashboard.rootPage.keyboard.press((await dashboard.isMacOs()) ? 'Meta+S' : 'Control+S');
    await dashboard.rootPage.waitForTimeout(500);

    fieldsText = await fields.getAllFieldText();
    expect(fieldsText).toEqual(['Title']);
  });
});
