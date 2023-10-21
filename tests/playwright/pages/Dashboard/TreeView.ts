import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '.';
import BasePage from '../Base';
import { NcContext } from '../../setup';
import { isEE } from '../../setup/db';

export class TreeViewPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly base: any;
  readonly quickImportButton: Locator;

  constructor(dashboard: DashboardPage, base: any) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.base = base;
    this.quickImportButton = dashboard.get().locator('.nc-import-menu');
  }

  get() {
    return this.dashboard.get().locator('.nc-treeview-container');
  }

  getAddNewTableBtn({ baseTitle }: { baseTitle: string }) {
    return this.dashboard
      .get()
      .getByTestId(`nc-sidebar-base-title-${baseTitle}`)
      .locator('[data-testid="nc-sidebar-add-base-entity"]');
  }

  private getProjectContextMenu({ baseTitle }: { baseTitle: string }) {
    return this.dashboard
      .get()
      .getByTestId(`nc-sidebar-base-title-${baseTitle}`)
      .locator('[data-testid="nc-sidebar-context-menu"]');
  }

  async isVisible() {
    return await this.get().isVisible();
  }

  async verifyVisibility({ isVisible }: { isVisible: boolean }) {
    await this.rootPage.waitForTimeout(1000);

    const domElement = await this.get();
    // get width of treeview dom element
    const width = (await domElement.boundingBox()).width;

    // if (isVisible) {
    //   await expect(this.get()).toBeVisible();
    // } else {
    //   await expect(this.get()).not.toBeVisible();
    // }

    // border for treeview is 1px
    // if not-visible, width should be < 5;
    if (!isVisible) {
      expect(width).toBeLessThan(5);
    } else {
      expect(width).toBeGreaterThan(5);
    }
  }

  async focusTable({ title }: { title: string }) {
    await this.get().locator(`.nc-base-tree-tbl-${title}`).focus();
  }

  async openBase({ title }: { title: string }) {
    const nodes = this.get().locator(`[data-testid="nc-sidebar-base-${title.toLowerCase()}"]`);
    await nodes.click();
    return;
  }

  async getTable({ index, tableTitle }: { index: number; tableTitle?: string }) {
    if (tableTitle) {
      return this.get().getByTestId(`nc-tbl-side-node-${tableTitle}`);
    }

    return this.get().locator('.nc-tree-item').nth(index);
  }

  // assumption: first view rendered is always GRID
  //
  async openTable({
    title,
    mode = 'standard',
    networkResponse = false,
    mobileMode = false,
  }: {
    title: string;
    mode?: string;
    networkResponse?: boolean;
    mobileMode?: boolean;
  }) {
    if (mobileMode) {
      await this.rootPage.locator('.h-full > div > .nc-sidebar-left-toggle-icon').click();
    }

    await this.get().getByTestId(`nc-tbl-title-${title}`).waitFor({ state: 'visible' });

    if (networkResponse === true) {
      await this.waitForResponse({
        uiAction: () =>
          this.get()
            .getByTestId(`nc-tbl-title-${title}`)
            .click({
              position: {
                x: 10,
                y: 10,
              },
            }),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: `/api/v1/db/data/noco`,
        responseJsonMatcher: json => json.pageInfo,
      });
      await this.dashboard.waitForTabRender({ title, mode });
    } else {
      await this.get().getByTestId(`nc-tbl-title-${title}`).click();
      await this.rootPage.waitForTimeout(1000);
    }
  }

  async createTable({
    title,
    skipOpeningModal,
    mode,
    baseTitle,
  }: {
    title: string;
    skipOpeningModal?: boolean;
    mode?: string;
    baseTitle: string;
  }) {
    if (!skipOpeningModal) {
      await this.get().getByTestId(`nc-sidebar-base-title-${baseTitle}`).hover();

      await this.get().getByTestId(`nc-sidebar-base-${baseTitle}`).getByTestId('nc-sidebar-add-base-entity').click();
    }

    await this.dashboard.get().locator('.ant-modal.active').locator('.ant-modal-body').waitFor();

    await this.dashboard.get().getByPlaceholder('Enter table name').fill(title);

    await this.waitForResponse({
      uiAction: () => this.dashboard.get().locator('button:has-text("Create Table")').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects/`,
      responseJsonMatcher: json => json.title === title && json.type === 'table',
    });

    // Tab render is slow for playwright
    await this.dashboard.waitForTabRender({ title, mode });
  }

  async verifyTable({ title, index, exists = true }: { title: string; index?: number; exists?: boolean }) {
    if (exists) {
      await expect(this.get().getByTestId(`nc-tbl-title-${title}`)).toHaveCount(1);

      if (index) {
        await expect(this.get().locator('.nc-tbl-title').nth(index)).toHaveText(title);
      }
    } else {
      await expect(this.get().getByTestId(`nc-tbl-title-${title}`)).toHaveCount(0);
    }
  }

  async deleteTable({ title }: { title: string }) {
    await this.get().locator(`.nc-base-tree-tbl-${title}`).waitFor({ state: 'visible' });

    await this.get().locator(`.nc-base-tree-tbl-${title}`).scrollIntoViewIfNeeded();
    await this.get().locator(`.nc-base-tree-tbl-${title}`).locator('.nc-tbl-context-menu').click();
    await this.rootPage.locator('.ant-dropdown').locator('.nc-menu-item:has-text("Delete")').click();

    await this.waitForResponse({
      uiAction: async () => {
        // Create a promise that resolves after 1 second
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        // Returning a promise that resolves with the result after the 1-second delay
        await delay(100);
        return await this.dashboard.get().locator('button:has-text("Delete Table")').click();
      },
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: `/api/v1/db/meta/tables/`,
    });

    await (await this.rootPage.locator('.nc-container').last().elementHandle())?.waitForElementState('stable');
  }

  async renameTable({ title, newTitle }: { title: string; newTitle: string }) {
    await this.get().locator(`.nc-base-tree-tbl-${title}`).waitFor({ state: 'visible' });
    await this.get().locator(`.nc-base-tree-tbl-${title}`).scrollIntoViewIfNeeded();
    await this.get().locator(`.nc-base-tree-tbl-${title}`).locator('.nc-tbl-context-menu').click();
    await this.rootPage.locator('.ant-dropdown').locator('.nc-menu-item:has-text("Rename")').click();

    await this.dashboard.get().locator('[placeholder="Enter table name"]').fill(newTitle);
    await this.dashboard.get().locator('button:has-text("Rename Table")').click();
    await this.verifyToast({ message: 'Table renamed successfully' });
  }

  async reorderTables({ sourceTable, destinationTable }: { sourceTable: string; destinationTable: string }) {
    await this.dashboard
      .get()
      .locator(`[data-testid="tree-view-table-draggable-handle-${sourceTable}"]`)
      .dragTo(this.get().locator(`[data-testid="nc-tbl-title-${destinationTable}"]`));
  }

  async baseSettings({ title }: { title?: string }) {
    await this.getProjectContextMenu({ baseTitle: title }).hover();
    await this.getProjectContextMenu({ baseTitle: title }).click();
    const settingsMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md');
    await settingsMenu.locator(`.nc-sidebar-base-base-settings`).click();
  }

  async quickImport({ title, baseTitle, context }: { title: string; baseTitle: string; context: NcContext }) {
    baseTitle = this.scopedProjectTitle({ title: baseTitle, context });

    await this.getProjectContextMenu({ baseTitle }).hover();
    await this.getProjectContextMenu({ baseTitle }).click();
    const importMenu = this.dashboard.get().locator('.ant-dropdown-menu');
    await importMenu.locator(`.nc-sub-menu:has-text("Import Data")`).click();
    await this.rootPage.locator(`.ant-dropdown-menu-item:has-text("${title}")`).waitFor();
    await this.rootPage.locator(`.ant-dropdown-menu-item:has-text("${title}")`).click();
  }

  async changeTableIcon({ title, icon, iconDisplay }: { title: string; icon: string; iconDisplay?: string }) {
    await this.get().locator(`.nc-base-tree-tbl-${title} .nc-table-icon`).click();

    await this.rootPage.locator('.emoji-mart-search > input').fill(icon);
    const emojiList = this.rootPage.locator('[id="emoji-mart-list"]');
    await emojiList.locator('button').first().click();
    await expect(
      this.get().locator(`.nc-base-tree-tbl-${title}`).locator(`.nc-table-icon:has-text("${iconDisplay}")`)
    ).toHaveCount(1);
  }

  async duplicateTable(title: string, includeData = true, includeViews = true) {
    await this.get().locator(`.nc-base-tree-tbl-${title}`).locator('.nc-icon.ant-dropdown-trigger').click();
    await this.dashboard.get().locator('div.nc-base-menu-item:has-text("Duplicate")').click();

    // Find the checkbox element with the label "Include data"
    const includeDataCheckbox = this.dashboard.get().getByText('Include data', { exact: true });
    // Check the checkbox if it is not already checked
    if ((await includeDataCheckbox.isChecked()) && !includeData) {
      await includeDataCheckbox.click(); // click the checkbox to check it
    }

    // Find the checkbox element with the label "Include data"
    const includeViewsCheckbox = this.dashboard.get().getByText('Include views', { exact: true });
    // Check the checkbox if it is not already checked
    if ((await includeViewsCheckbox.isChecked()) && !includeViews) {
      await includeViewsCheckbox.click(); // click the checkbox to check it
    }

    await this.waitForResponse({
      uiAction: async () => await this.rootPage.getByRole('button', { name: 'Confirm' }).click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/api/v1/db/meta/duplicate/`,
    });
    await this.get().locator(`[data-testid="nc-tbl-title-${title} copy"]`).waitFor();
  }

  async verifyTabIcon({ title, icon, iconDisplay }: { title: string; icon: string; iconDisplay?: string }) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.rootPage.locator(`.nc-base-tree-tbl-${title}`).waitFor({ state: 'visible' });
    await expect(
      this.get().locator(`.nc-base-tree-tbl-${title}`).locator(`.nc-table-icon:has-text("${iconDisplay}")`)
    ).toHaveCount(1);
  }

  async validateRoleAccess(param: {
    role: string;
    baseTitle?: string;
    tableTitle?: string;
    mode?: string;
    context: NcContext;
  }) {
    const context = param.context;
    param.baseTitle = param.baseTitle ?? context.base.title;

    const count = param.role.toLowerCase() === 'creator' || param.role.toLowerCase() === 'owner' ? 1 : 0;
    const pjtNode = await this.getProject({ title: param.baseTitle });
    await pjtNode.hover();

    if (param.mode !== 'shareBase') {
      // add new table button & context menu is visible only for owner & creator
      await expect(pjtNode.locator('[data-testid="nc-sidebar-add-base-entity"]')).toHaveCount(count);
      await expect(pjtNode.locator('[data-testid="nc-sidebar-context-menu"]')).toHaveCount(1);

      // table context menu
      const tblNode = await this.getTable({ index: 0, tableTitle: param.tableTitle });
      await tblNode.hover();
      await expect(tblNode.locator('.nc-tbl-context-menu')).toHaveCount(count);
    }
  }

  async openProject({ title, context }: { title: string; context: NcContext }) {
    title = this.scopedProjectTitle({ title, context });

    await this.get().getByTestId(`nc-sidebar-base-title-${title}`).click();
    await this.rootPage.waitForTimeout(1000);

    // TODO: FIx why base click is not always registering
    await this.get().getByTestId(`nc-sidebar-base-title-${title}`).click();
    await this.rootPage.waitForTimeout(1000);
  }

  scopedProjectTitle({ title, context }: { title: string; context: NcContext }) {
    if (isEE()) return title;

    if (title.toLowerCase().startsWith('xcdb')) return `${title}`;

    return title === context.base.title ? context.base.title : `nc-${context.workerId}-${title}`;
  }

  private async getProject(param: { title?: string }) {
    return this.get().getByTestId(`nc-sidebar-base-title-${param.title}`);
  }

  async renameProject(param: { newTitle: string; title: string; context: NcContext }) {
    param.title = this.scopedProjectTitle({ title: param.title, context: param.context });
    param.newTitle = this.scopedProjectTitle({ title: param.newTitle, context: param.context });

    await this.getProjectContextMenu({ baseTitle: param.title }).hover();
    await this.getProjectContextMenu({ baseTitle: param.title }).click();
    const contextMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md:visible').last();
    await contextMenu.waitFor();
    await contextMenu.locator(`.ant-dropdown-menu-item:has-text("Rename")`).click();

    const baseNodeInput = (await this.getProject({ title: param.title })).locator('input');
    await baseNodeInput.clear();
    await baseNodeInput.fill(param.newTitle);
    await baseNodeInput.press('Enter');
  }

  async deleteProject(param: { title: string; context: NcContext }) {
    param.title = this.scopedProjectTitle({ title: param.title, context: param.context });

    await this.getProjectContextMenu({ baseTitle: param.title }).hover();
    await this.getProjectContextMenu({ baseTitle: param.title }).click();
    const contextMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md:visible').last();
    await contextMenu.waitFor();
    await contextMenu.locator(`.ant-dropdown-menu-item:has-text("Delete")`).click();

    await this.rootPage.locator('div.ant-modal-content').locator(`button.ant-btn:has-text("Delete")`).click();
  }

  async duplicateProject(param: { title: string; context: NcContext }) {
    param.title = this.scopedProjectTitle({ title: param.title, context: param.context });

    await this.getProjectContextMenu({ baseTitle: param.title }).hover();
    await this.getProjectContextMenu({ baseTitle: param.title }).click();
    const contextMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md:visible');
    await contextMenu.waitFor();
    await contextMenu.locator(`.ant-dropdown-menu-item:has-text("Duplicate")`).click();

    await this.rootPage.locator('div.ant-modal-content').locator(`button.ant-btn:has-text("Confirm")`).click();

    await this.rootPage.waitForTimeout(10000);
  }
}
