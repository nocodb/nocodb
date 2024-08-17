import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { Api } from 'nocodb-sdk';
import { DataSourcePage } from '../../../pages/Dashboard/ProjectView/DataSourcePage';

test.describe('Source Restrictions', () => {
  let dashboard: DashboardPage;
  let dataSourcesPage: DataSourcePage;
  let context: NcContext;
  let api: Api<any>;
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    dataSourcesPage = dashboard.baseView.dataSources;
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Readonly data source', async () => {
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.tab_dataSources.click();

    await dashboard.rootPage.waitForTimeout(300);

    await dataSourcesPage.source.updateSchemaReadOnly({ sourceName: 'Default', readOnly: true });
    await dataSourcesPage.source.updateDataReadOnly({ sourceName: 'Default', readOnly: true });

    // reload page to reflect source changes
    await dashboard.rootPage.reload();

    await dashboard.treeView.verifyTable({ title: 'Actor' });

    // open table and verify that it is readonly
    await dashboard.treeView.openTable({ title: 'Actor' });
    await expect(dashboard.grid.get().locator('.nc-grid-add-new-cell')).toHaveCount(0);

    await dashboard.grid.get().getByTestId(`cell-FirstName-0`).click({
      button: 'right',
    });

    await expect(dashboard.rootPage.locator('.ant-dropdown-menu-item:has-text("Copy")')).toHaveCount(1);
    await expect(dashboard.rootPage.locator('.ant-dropdown-menu-item:has-text("Delete record")')).toHaveCount(0);
  });

  test('Readonly schema source', async () => {
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.tab_dataSources.click();

    await dashboard.rootPage.waitForTimeout(300);

    await dataSourcesPage.source.updateSchemaReadOnly({ sourceName: 'Default', readOnly: true });
    // reload page to reflect source changes
    await dashboard.rootPage.reload();

    await dashboard.treeView.verifyTable({ title: 'Actor' });

    // open table and verify that it is readonly
    await dashboard.treeView.openTable({ title: 'Actor' });

    await dashboard.grid
      .get()
      .locator(`th[data-title="LastName"]`)
      .first()
      .locator('.nc-ui-dt-dropdown')
      .scrollIntoViewIfNeeded();
    await dashboard.grid.get().locator(`th[data-title="LastName"]`).first().locator('.nc-ui-dt-dropdown').click();
    for (const item of ['Edit', 'Delete', 'Duplicate']) {
      await expect(dashboard.rootPage.locator(`li[role="menuitem"]:has-text("${item}"):visible`).first()).toBeVisible();
      await expect(dashboard.rootPage.locator(`li[role="menuitem"]:has-text("${item}"):visible`).first()).toHaveClass(
        /ant-dropdown-menu-item-disabled/
      );
    }
  });

  test('Readonly schema source - edit column', async () => {
    await dashboard.treeView.openTable({
      title: 'Country',
    });

    // Create Rating column
    await dashboard.grid.column.create({
      title: 'Rating',
      type: 'Rating',
    });

    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.tab_dataSources.click();

    await dashboard.rootPage.waitForTimeout(300);

    await dataSourcesPage.source.updateSchemaReadOnly({ sourceName: 'Default', readOnly: true });
    // reload page to reflect source changes
    await dashboard.rootPage.reload();

    await dashboard.treeView.verifyTable({ title: 'Country' });

    // open table and verify that it is readonly
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid
      .get()
      .locator(`th[data-title="Rating"]`)
      .first()
      .locator('.nc-ui-dt-dropdown')
      .scrollIntoViewIfNeeded();

    await dashboard.grid.get().locator(`th[data-title="Rating"]`).first().locator('.nc-ui-dt-dropdown').click();
    for (const item of ['Delete', 'Duplicate']) {
      await expect(dashboard.rootPage.locator(`li[role="menuitem"]:has-text("${item}"):visible`).last()).toBeVisible();
      await expect(dashboard.rootPage.locator(`li[role="menuitem"]:has-text("${item}"):visible`).last()).toHaveClass(
        /ant-dropdown-menu-item-disabled/
      );
    }

    await expect(await dashboard.rootPage.locator(`li[role="menuitem"]:has-text("Edit"):visible`).last()).toBeVisible();

    await dashboard.rootPage.locator(`li[role="menuitem"]:has-text("Edit"):visible`).last().click();
    await dashboard.rootPage.waitForTimeout(300);
    await expect(
      dashboard.rootPage.locator(`.nc-dropdown-edit-column .ant-form-item-label:has-text("Icon")`).last()
    ).toBeVisible();

    await dashboard.rootPage.locator(`.nc-dropdown-edit-column`).getByTestId('nc-dropdown-rating-max').click();

    await dashboard.rootPage.locator(`.nc-dropdown-rating-max-option:has-text("9")`).click();

    await dashboard.grid.column.save({ isUpdated: true });

    await dashboard.grid.cell.rating.select({ index: 0, columnHeader: 'Rating', rating: 6 });
    await dashboard.grid.cell.rating.verify({ index: 0, columnHeader: 'Rating', rating: 6 });
  });
});
