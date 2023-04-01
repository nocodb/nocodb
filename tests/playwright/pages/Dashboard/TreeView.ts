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

    if ((await this.get().locator('.active.nc-project-tree-tbl').count()) > 0) {
      if ((await this.get().locator('.active.nc-project-tree-tbl').innerText()) === title) {
        // table already open
        return;
      }
    }

    if (networkResponse === true) {
      await this.waitForResponse({
        uiAction: () => this.get().locator(`.nc-project-tree-tbl-${title}`).click(),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: `/api/v1/db/data/noco/`,
        responseJsonMatcher: json => json.pageInfo,
      });
      await this.dashboard.waitForTabRender({ title, mode });
    } else {
      await this.get().locator(`.nc-project-tree-tbl-${title}`).click();
      await this.rootPage.waitForTimeout(3000);
    }
  }

  async createTable({ title, skipOpeningModal }: { title: string; skipOpeningModal?: boolean }) {
    if (!skipOpeningModal) await this.get().locator('.nc-add-new-table').click();

    await this.dashboard.get().locator('.nc-modal-table-create').locator('.ant-modal-body').waitFor();

    await this.dashboard.get().getByPlaceholder('Enter table name').fill(title);

    await this.waitForResponse({
      uiAction: () => this.dashboard.get().locator('button:has-text("Submit")').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects/`,
      responseJsonMatcher: json => json.title === title && json.type === 'table',
    });

    // Tab render is slow for playwright
    await this.dashboard.waitForTabRender({ title });
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
    await this.get().locator(`.nc-project-tree-tbl-${title}`).click({ button: 'right' });
    await this.dashboard.get().locator('div.nc-project-menu-item:has-text("Delete")').click();

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
    await this.get().locator(`.nc-project-tree-tbl-${title}`).click({ button: 'right' });
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
    await this.get().locator('.nc-add-new-table').hover();
    await this.quickImportButton.click();
    const importMenu = this.dashboard.get().locator('.nc-dropdown-import-menu');
    await importMenu.locator(`.ant-dropdown-menu-title-content:has-text("${title}")`).click();
  }

  async changeTableIcon({ title, icon }: { title: string; icon: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title} .nc-table-icon`).click();

    await this.rootPage.getByTestId('nc-emoji-filter').type(icon);
    await this.rootPage.getByTestId('nc-emoji-container').locator(`.nc-emoji-item >> svg`).first().click();

    await this.rootPage.getByTestId('nc-emoji-container').isHidden();
    await expect(
      this.get().locator(`.nc-project-tree-tbl-${title} [data-testid="nc-icon-emojione:${icon}"]`)
    ).toHaveCount(1);
  }

  async verifyTabIcon({ title, icon }: { title: string; icon: string }) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await expect(
      this.rootPage.locator(
        `[data-testid="nc-tab-title"]:has-text("${title}") [data-testid="nc-tab-icon-emojione:${icon}"]`
      )
    ).toBeVisible();
  }

  // todo: Break this into smaller methods
  async validateRoleAccess(param: { role: string }) {
    // Add new table button
    await expect(this.get().locator(`.nc-add-new-table`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Import menu
    await expect(this.get().locator(`.nc-import-menu`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Team and Settings button
    await expect(this.get().locator(`.nc-new-base`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Right click context menu
    await this.get().locator(`.nc-project-tree-tbl-Country`).click({
      button: 'right',
    });
    await expect(this.rootPage.locator(`.nc-dropdown-tree-view-context-menu:visible`)).toHaveCount(
      param.role === 'creator' ? 1 : 0
    );
  }
}
