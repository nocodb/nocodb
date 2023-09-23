import BasePage from '../../../Base';
import { SidebarPage } from '..';
import { expect } from '@playwright/test';

export class SidebarTableNodeObject extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(parent: SidebarPage) {
    super(parent.rootPage);

    this.sidebar = parent;
  }

  get({ tableTitle }: { tableTitle: string }) {
    return this.sidebar.get().getByTestId(`nc-tbl-side-node-${tableTitle}`);
  }

  async click({ tableTitle }: { tableTitle: string }) {
    await this.get({
      tableTitle,
    }).click();
  }

  async clickOptions({ tableTitle }: { tableTitle: string }) {
    await this.get({
      tableTitle,
    }).hover();

    await this.get({
      tableTitle,
    })
      .getByTestId(`nc-sidebar-table-context-menu`)
      .click();
  }

  async verifyTableOptions({
    tableTitle,
    isVisible,
    renameVisible,
    duplicateVisible,
    deleteVisible,
  }: {
    tableTitle: string;
    isVisible: boolean;
    renameVisible?: boolean;
    duplicateVisible?: boolean;
    deleteVisible?: boolean;
  }) {
    const optionsLocator = await this.get({
      tableTitle,
    }).getByTestId('nc-sidebar-table-context-menu');
    if (isVisible) await optionsLocator.isVisible();
    else {
      await expect(optionsLocator).toHaveCount(0);
      return;
    }

    const renameLocator = await this.rootPage.getByTestId(`sidebar-table-rename-${tableTitle}`);

    if (renameVisible) await renameLocator.isVisible();
    else await expect(renameLocator).toHaveCount(0);

    const duplicateLocator = await this.rootPage.getByTestId(`sidebar-table-duplicate-${tableTitle}`);

    if (duplicateVisible) await expect(duplicateLocator).toBeVisible();
    else await expect(duplicateLocator).toHaveCount(0);

    const deleteLocator = await this.rootPage.getByTestId(`sidebar-table-delete-${tableTitle}`);

    if (deleteVisible) await expect(deleteLocator).toBeVisible();
    else await expect(deleteLocator).toHaveCount(0);
  }
}
