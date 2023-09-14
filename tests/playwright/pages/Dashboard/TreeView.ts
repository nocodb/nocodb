import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '.';
import BasePage from '../Base';

export class TreeViewPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly project: any;
  readonly quickImportButton: Locator;

  constructor(dashboard: DashboardPage, project: any) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.project = project;
    this.quickImportButton = dashboard.get().locator('.nc-import-menu');
  }

  get() {
    return this.dashboard.get().locator('.nc-treeview-container');
  }

  getAddNewTableBtn({ projectTitle }: { projectTitle: string }) {
    return this.dashboard
      .get()
      .getByTestId(`nc-sidebar-project-title-${projectTitle}`)
      .locator('[data-testid="nc-sidebar-add-project-entity"]');
  }

  getProjectContextMenu({ projectTitle }: { projectTitle: string }) {
    return this.dashboard
      .get()
      .getByTestId(`nc-sidebar-project-title-${projectTitle}`)
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
    await this.get().locator(`.nc-project-tree-tbl-${title}`).focus();
  }

  async openBase({ title }: { title: string }) {
    const nodes = this.get().locator(`[data-testid="nc-sidebar-project-${title.toLowerCase()}"]`);
    await nodes.click();
    return;
  }

  async getTable({ index, tableTitle }: { index: number; tableTitle?: string }) {
    if (tableTitle) {
      return this.get().getByTestId(`tree-view-table-${tableTitle}`);
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

    await this.get().getByTestId(`tree-view-table-${title}`).waitFor({ state: 'visible' });

    if (networkResponse === true) {
      await this.waitForResponse({
        uiAction: () => this.get().getByTestId(`tree-view-table-${title}`).click(),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: `/api/v1/db/data/noco/`,
        responseJsonMatcher: json => json.pageInfo,
      });
      await this.dashboard.waitForTabRender({ title, mode });
    } else {
      await this.get().getByTestId(`tree-view-table-${title}`).click();
      await this.rootPage.waitForTimeout(1000);
    }
  }

  async createTable({
    title,
    skipOpeningModal,
    mode,
    projectTitle,
  }: {
    title: string;
    skipOpeningModal?: boolean;
    mode?: string;
    projectTitle: string;
  }) {
    if (!skipOpeningModal) {
      await this.get().getByTestId(`nc-sidebar-project-title-${projectTitle}`).hover();

      await this.get()
        .getByTestId(`nc-sidebar-project-${projectTitle}`)
        .getByTestId('nc-sidebar-add-project-entity')
        .click();
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
      await expect(this.get().getByTestId(`tree-view-table-${title}`)).toHaveCount(1);

      if (index) {
        await expect(this.get().locator('.nc-tbl-title').nth(index)).toHaveText(title);
      }
    } else {
      await expect(this.get().getByTestId(`tree-view-table-${title}`)).toHaveCount(0);
    }
  }

  async deleteTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).waitFor({ state: 'visible' });

    await this.get().locator(`.nc-project-tree-tbl-${title}`).scrollIntoViewIfNeeded();
    await this.get().locator(`.nc-project-tree-tbl-${title}`).locator('.nc-tbl-context-menu').click();
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

    await expect
      .poll(
        async () =>
          await this.dashboard.tabBar
            .locator('.ant-tabs-tab', {
              hasText: title,
            })
            .isVisible()
      )
      .toBe(false);

    await (await this.rootPage.locator('.nc-container').last().elementHandle())?.waitForElementState('stable');
  }

  async renameTable({ title, newTitle }: { title: string; newTitle: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).waitFor({ state: 'visible' });
    await this.get().locator(`.nc-project-tree-tbl-${title}`).scrollIntoViewIfNeeded();
    await this.get().locator(`.nc-project-tree-tbl-${title}`).locator('.nc-tbl-context-menu').click();
    await this.rootPage.locator('.ant-dropdown').locator('.nc-menu-item:has-text("Rename")').click();

    await this.dashboard.get().locator('[placeholder="Enter table name"]').fill(newTitle);
    await this.dashboard.get().locator('button:has-text("Rename Table")').click();
    await this.verifyToast({ message: 'Table renamed successfully' });
  }

  async reorderTables({ sourceTable, destinationTable }: { sourceTable: string; destinationTable: string }) {
    await this.dashboard
      .get()
      .locator(`[data-testid="tree-view-table-draggable-handle-${sourceTable}"]`)
      .dragTo(this.get().locator(`[data-testid="tree-view-table-${destinationTable}"]`));
  }

  async projectSettings({ title }: { title?: string }) {
    await this.getProjectContextMenu({ projectTitle: title }).hover();
    await this.getProjectContextMenu({ projectTitle: title }).click();
    const settingsMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md');
    await settingsMenu.locator(`.nc-sidebar-project-project-settings`).click();
  }

  async quickImport({ title, projectTitle }: { title: string; projectTitle: string }) {
    await this.getProjectContextMenu({ projectTitle }).hover();
    await this.getProjectContextMenu({ projectTitle }).click();
    const importMenu = this.dashboard.get().locator('.ant-dropdown-menu');
    await importMenu.locator(`.nc-sub-menu:has-text("Import Data")`).click();
    await this.rootPage.locator(`.ant-dropdown-menu-item:has-text("${title}")`).waitFor();
    await this.rootPage.locator(`.ant-dropdown-menu-item:has-text("${title}")`).click();
  }

  async changeTableIcon({ title, icon, iconDisplay }: { title: string; icon: string; iconDisplay?: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title} .nc-table-icon`).click();

    await this.rootPage.locator('.emoji-mart-search').type(icon);
    const emojiList = this.rootPage.locator('[id="emoji-mart-list"]');
    await emojiList.locator('button').first().click();
    await expect(
      this.get().locator(`.nc-project-tree-tbl-${title}`).locator(`.nc-table-icon:has-text("${iconDisplay}")`)
    ).toHaveCount(1);
  }

  async duplicateTable(title: string, includeData = true, includeViews = true) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).locator('.nc-icon.ant-dropdown-trigger').click();
    await this.dashboard.get().locator('div.nc-project-menu-item:has-text("Duplicate")').click();

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
    await this.get().locator(`[data-testid="tree-view-table-${title} copy"]`).waitFor();
  }

  async verifyTabIcon({ title, icon, iconDisplay }: { title: string; icon: string; iconDisplay?: string }) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.rootPage.locator(`.nc-project-tree-tbl-${title}`).waitFor({ state: 'visible' });
    await expect(
      this.get().locator(`.nc-project-tree-tbl-${title}`).locator(`.nc-table-icon:has-text("${iconDisplay}")`)
    ).toHaveCount(1);
  }

  async validateRoleAccess(param: { role: string; projectTitle?: string; tableTitle?: string }) {
    const count = param.role.toLowerCase() === 'creator' || param.role.toLowerCase() === 'owner' ? 1 : 0;
    const pjtNode = await this.getProject({ index: 0, title: param.projectTitle });
    await pjtNode.hover();

    // add new table button & context menu is visible only for owner & creator
    await expect(pjtNode.locator('[data-testid="nc-sidebar-add-project-entity"]')).toHaveCount(count);
    await expect(pjtNode.locator('[data-testid="nc-sidebar-context-menu"]')).toHaveCount(count);

    // table context menu
    const tblNode = await this.getTable({ index: 0, tableTitle: param.tableTitle });
    await tblNode.hover();
    await expect(tblNode.locator('.nc-tbl-context-menu')).toHaveCount(count);
  }

  async openProject({ title, projectCount }: { title: string; projectCount?: number }) {
    const nodes = this.get().locator(`.project-title-node`);

    // at times, page is not rendered yet when trying to open project
    // hence retry logic to wait for expected number of projects to be available
    if (projectCount) {
      let retryCount = 0;
      while (retryCount < 5) {
        if ((await nodes.count()) === projectCount) break;
        await this.rootPage.waitForTimeout(retryCount * 500);
        retryCount++;
      }
    }

    // loop through nodes.count() to find the node with title
    for (let i = 0; i < (await nodes.count()); i++) {
      const node = nodes.nth(i);
      const nodeTitle = await node.innerText();

      // check if nodeTitle contains title
      if (nodeTitle.toLowerCase().includes(title.toLowerCase())) {
        // click on node
        await node.waitFor({ state: 'visible' });
        await node.click();
        break;
      }
    }

    await this.rootPage.waitForTimeout(1000);
  }

  private async getProject(param: { index: number; title?: string }) {
    if (param.title) {
      return this.get().getByTestId(`nc-sidebar-project-title-${param.title}`);
    }

    return this.get().locator(`.project-title-node`).nth(param.index);
  }

  async renameProject(param: { newTitle: string; title: string }) {
    await this.getProjectContextMenu({ projectTitle: param.title }).hover();
    await this.getProjectContextMenu({ projectTitle: param.title }).click();
    const contextMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md:visible').last();
    await contextMenu.waitFor();
    await contextMenu.locator(`.ant-dropdown-menu-item:has-text("Rename")`).click();

    const projectNodeInput = (await this.getProject({ index: 0, title: param.title })).locator('input');
    await projectNodeInput.clear();
    await projectNodeInput.fill(param.newTitle);
    await projectNodeInput.press('Enter');
  }

  async deleteProject(param: { title: string }) {
    await this.getProjectContextMenu({ projectTitle: param.title }).hover();
    await this.getProjectContextMenu({ projectTitle: param.title }).click();
    const contextMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md:visible').last();
    await contextMenu.waitFor();
    await contextMenu.locator(`.ant-dropdown-menu-item:has-text("Delete")`).click();

    await this.rootPage.locator('div.ant-modal-content').locator(`button.ant-btn:has-text("Delete")`).click();
  }

  async duplicateProject(param: { title: string }) {
    await this.getProjectContextMenu({ projectTitle: param.title }).hover();
    await this.getProjectContextMenu({ projectTitle: param.title }).click();
    const contextMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md:visible');
    await contextMenu.waitFor();
    await contextMenu.locator(`.ant-dropdown-menu-item:has-text("Duplicate")`).click();

    await this.rootPage.locator('div.ant-modal-content').locator(`button.ant-btn:has-text("Confirm")`).click();
  }
}
