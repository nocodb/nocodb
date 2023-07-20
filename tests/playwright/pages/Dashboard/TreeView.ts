import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '.';
import BasePage from '../Base';
import { isHub } from '../../setup/db';

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
    let nodes: Locator;
    if (isHub()) {
      nodes = await this.get().locator(`[data-testid="nc-sidebar-project-${title.toLowerCase()}"]`);
      await nodes.click();
      return;
    } else {
      nodes = await this.get().locator(`.ant-collapse`);
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

    await this.rootPage.waitForTimeout(2000);
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
    if (isHub()) {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).locator('.nc-icon.ant-dropdown-trigger').click();
    } else {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).click({ button: 'right' });
    }
    await this.dashboard.get().locator('div.nc-project-menu-item:has-text("Delete"):visible').click();

    await this.waitForResponse({
      uiAction: () => this.dashboard.get().locator('button:has-text("Yes")').click(),
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

    (await this.rootPage.locator('.nc-container').last().elementHandle())?.waitForElementState('stable');
  }

  async renameTable({ title, newTitle }: { title: string; newTitle: string }) {
    if (isHub()) {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).locator('.nc-icon.ant-dropdown-trigger').click();
    } else {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).click({ button: 'right' });
    }
    await this.dashboard.get().locator('div.nc-project-menu-item:has-text("Rename")').click();
    await this.dashboard.get().locator('[placeholder="Enter table name"]').fill(newTitle);
    await this.dashboard.get().locator('button:has-text("Submit")').click();
    await this.verifyToast({ message: 'Table renamed successfully' });
  }

  async reorderTables({ sourceTable, destinationTable }: { sourceTable: string; destinationTable: string }) {
    await this.dashboard
      .get()
      .locator(`[data-testid="tree-view-table-draggable-handle-${sourceTable}"]`)
      .dragTo(this.get().locator(`[data-testid="tree-view-table-${destinationTable}"]`));
  }

  async quickImport({ title }: { title: string }) {
    if (isHub()) {
      const addProject: Locator = this.get().locator('[data-testid="nc-sidebar-context-menu"]');
      await addProject.hover();
      await addProject.click();
      const importMenu = this.dashboard.get().locator('.ant-dropdown-menu.nc-scrollbar-md');
      await importMenu.locator(`.ant-dropdown-menu-submenu:has-text("Quick Import From")`).click();
      await this.rootPage.locator(`.ant-dropdown-menu-item:has-text("${title}")`).waitFor();
      await this.rootPage.locator(`.ant-dropdown-menu-item:has-text("${title}")`).click();
    } else {
      await this.get().locator('.nc-add-new-table').hover();
      await this.quickImportButton.click();
      const importMenu = this.dashboard.get().locator('.nc-dropdown-import-menu');
      await importMenu.locator(`.ant-dropdown-menu-title-content:has-text("${title}")`).click();
    }
  }

  async changeTableIcon({ title, icon, iconDisplay }: { title: string; icon: string; iconDisplay?: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title} .nc-table-icon`).click();

    if (isHub()) {
      await this.rootPage.locator('.emoji-mart-search').type(icon);
      const emojiList = await this.rootPage.locator('[id="emoji-mart-list"]');
      await emojiList.locator('button').first().click();
      await expect(
        this.get().locator(`.nc-project-tree-tbl-${title}`).locator(`.nc-table-icon:has-text("${iconDisplay}")`)
      ).toHaveCount(1);
    } else {
      await this.rootPage.getByTestId('nc-emoji-filter').type(icon);
      await this.rootPage.getByTestId('nc-emoji-container').locator(`.nc-emoji-item >> svg`).first().click();

      await this.rootPage.getByTestId('nc-emoji-container').isHidden();
      await expect(
        this.get().locator(`.nc-project-tree-tbl-${title} [data-testid="nc-icon-emojione:${icon}"]`)
      ).toHaveCount(1);
    }
  }

  async duplicateTable(title: string, includeData = true, includeViews = true) {
    if (isHub()) {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).locator('.nc-icon.ant-dropdown-trigger').click();
    } else {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).click({ button: 'right' });
    }
    await this.dashboard.get().locator('div.nc-project-menu-item:has-text("Duplicate")').click();

    // Find the checkbox element with the label "Include data"
    const includeDataCheckbox = await this.dashboard.get().getByText('Include data', { exact: true });
    // Check the checkbox if it is not already checked
    if ((await includeDataCheckbox.isChecked()) && !includeData) {
      await includeDataCheckbox.click(); // click the checkbox to check it
    }

    // Find the checkbox element with the label "Include data"
    const includeViewsCheckbox = await this.dashboard.get().getByText('Include views', { exact: true });
    // Check the checkbox if it is not already checked
    if ((await includeViewsCheckbox.isChecked()) && !includeViews) {
      await includeViewsCheckbox.click(); // click the checkbox to check it
    }

    await this.waitForResponse({
      uiAction: () => this.rootPage.getByRole('button', { name: 'Confirm' }).click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/api/v1/db/meta/duplicate/`,
    });
    await this.get().locator(`[data-testid="tree-view-table-${title} copy"]`).waitFor();
  }

  async verifyTabIcon({ title, icon, iconDisplay }: { title: string; icon: string; iconDisplay?: string }) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // tbd: check if we can have a common method for this
    if (isHub()) {
      await this.rootPage.locator(`.nc-project-tree-tbl-${title}`).waitFor({ state: 'visible' });
      await expect(
        this.get().locator(`.nc-project-tree-tbl-${title}`).locator(`.nc-table-icon:has-text("${iconDisplay}")`)
      ).toHaveCount(1);
    } else {
      await expect(
        this.rootPage.locator(
          `[data-testid="nc-tab-title"]:has-text("${title}") [data-testid="nc-icon-emojione:${icon}"]`
        )
      ).toBeVisible();
    }
  }

  // todo: Break this into smaller methods
  async validateRoleAccess(param: { role: string }) {
    // Add new table button
    await expect(this.get().locator(`.nc-add-new-table:visible`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Import menu
    await expect(this.get().locator(`.nc-import-menu:visible`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    if (isHub()) {
      // Create project at bottom right of tree view (should be visible for everyone)
      await expect(this.get().locator(`.nc-create-project-btn:visible`)).toHaveCount(1);
    } else {
      // Team and Settings button
      await expect(this.get().locator(`.nc-new-base`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    }

    // hub has 'reload' option across all 3 roles
    // double check against options defined in nocodb
    if (!isHub()) {
      // Right click context menu
      await this.get().locator(`.nc-project-tree-tbl-Country`).click({
        button: 'right',
      });
      await expect(this.rootPage.locator(`.nc-dropdown-tree-view-context-menu:visible`)).toHaveCount(
        param.role === 'creator' ? 1 : 0
      );
    }
  }

  async openProject(param: { title: string }) {
    const nodes = await this.get().locator(`.nc-project-sub-menu`);

    // loop through nodes.count() to find the node with title
    for (let i = 0; i < (await nodes.count()); i++) {
      const node = nodes.nth(i);
      const nodeTitle = await node.innerText();
      // check if nodeTitle contains title
      if (nodeTitle.toLowerCase().includes(param.title.toLowerCase())) {
        // click on node
        await node.waitFor({ state: 'visible' });
        await node.click();
        break;
      }
    }

    await this.rootPage.waitForTimeout(1000);
  }
}
