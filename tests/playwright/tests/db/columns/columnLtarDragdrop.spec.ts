import { expect, test } from '@playwright/test';
import setup, { unsetup } from '../../../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import { getTextExcludeIconText } from '../../../tests/utils/general';
import { isEE } from '../../../setup/db';
let api: Api<any>;
const recordCount = 10;

test.describe('Links', () => {
  let context: any;
  let dashboard: DashboardPage;
  let grid: GridPage;
  const tables = [];

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Title',
        title: 'Title',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];

    const rows = [];
    for (let i = 0; i < recordCount; i++) {
      rows.push({
        Id: i + 1,
        Title: `${i + 1}`,
      });
    }

    // Create tables
    const base = await api.base.read(context.base.id);

    for (let i = 0; i < 2; i++) {
      const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: `Table${i}`,
        title: `Table${i}`,
        columns: columns,
      });
      tables.push(table);
      await api.dbTableRow.bulkCreate('noco', context.base.id, tables[i].id, rows);
    }

    // refresh page
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('drag drop for Link, lookup creation', async () => {
    await dashboard.treeView.openTable({ title: 'Table0' });
    const src = dashboard.rootPage.locator(`[data-testid="tree-view-table-draggable-handle-Table1"]`);
    const dst = dashboard.rootPage.locator(`[data-testid="grid-row-0"]`);

    // drag drop for LTAR column creation
    //
    await src.dragTo(dst);
    const columnAddModal = dashboard.rootPage.locator(`.nc-dropdown-grid-add-column`);
    {
      const columnType = await getTextExcludeIconText(columnAddModal.locator(`.nc-column-type-input`));
      const linkTable = await getTextExcludeIconText(columnAddModal.locator(`.ant-form-item-control-input`).nth(3));
      expect(columnType).toContain('Links');
      expect(linkTable).toContain('Table1');

      // save
      await columnAddModal.locator(`.ant-btn-primary`).click();

      // verify if column is created
      await grid.column.verify({ title: 'Table1List', isVisible: true });
    }

    // drag drop for lookup column creation
    //
    await src.dragTo(dst);
    {
      // const columnAddModal = await dashboard.rootPage.locator(`.nc-dropdown-grid-add-column`);
      const columnType = await getTextExcludeIconText(columnAddModal.locator(`.nc-column-type-input`));
      const linkField = await getTextExcludeIconText(columnAddModal.locator(`.ant-form-item-control-input`).nth(2));
      const childColumn = await getTextExcludeIconText(columnAddModal.locator(`.ant-form-item-control-input`).nth(3));

      // TODO: Handle this in EE
      if (isEE()) return;

      // validate
      expect(columnType).toContain('Lookup');
      expect(linkField).toContain('Table1List');
      expect(childColumn).toContain('Title');

      // save
      await columnAddModal.locator(`.ant-btn-primary`).click();

      // verify if column is created
      await grid.column.verify({ title: 'Table1 Lookup', isVisible: true });
    }
  });
});
