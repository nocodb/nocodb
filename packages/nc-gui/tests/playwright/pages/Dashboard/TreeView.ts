import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '.';
import BasePage from '../Base';

export class TreeViewPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly project: any;
  readonly quickImportButton: Locator;
  readonly inviteTeamButton: Locator;

  constructor(dashboard: DashboardPage, project: any) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.project = project;
    this.quickImportButton = dashboard.get().locator('.nc-import-menu');
    this.inviteTeamButton = dashboard.get().locator('.nc-share-base');
  }

  get() {
    return this.dashboard.get().locator('.nc-treeview-container');
  }

  async focusTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).focus();
  }

  // assumption: first view rendered is always GRID
  //
  async openTable({ title, mode = 'standard' }: { title: string; mode?: string }) {
    if ((await this.get().locator('.active.nc-project-tree-tbl').count()) > 0) {
      if ((await this.get().locator('.active.nc-project-tree-tbl').innerText()) === title) {
        // table already open
        return;
      }
    }

    await this.waitForResponse({
      uiAction: this.get().locator(`.nc-project-tree-tbl-${title}`).click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco/`,
      responseJsonMatcher: json => json.pageInfo,
    });
    await this.dashboard.waitForTabRender({ title, mode });
  }

  async createTable({ title }: { title: string }) {
    await this.get().locator('.nc-add-new-table').click();

    await this.dashboard.get().locator('.nc-modal-table-create').locator('.ant-modal-body').waitFor();

    await this.dashboard.get().getByPlaceholder('Enter table name').fill(title);

    await this.waitForResponse({
      uiAction: this.dashboard.get().locator('button:has-text("Submit")').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `/api/v1/db/meta/projects/`,
      responseJsonMatcher: json => json.title === title && json.type === 'table',
    });

    await this.dashboard.waitForTabRender({ title });
  }

  async verifyTable({ title, index, exists = true }: { title: string; index?: number; exists?: boolean }) {
    if (exists) {
      await expect(this.get().locator(`.nc-project-tree-tbl-${title}`)).toBeVisible();

      if (index) {
        await expect(await this.get().locator('.nc-tbl-title').nth(index)).toHaveText(title);
      }
    } else {
      await expect(this.get().locator(`.nc-project-tree-tbl-${title}`)).toHaveCount(0);
    }
  }

  async deleteTable({ title }: { title: string }) {
    await this.get().locator(`.nc-project-tree-tbl-${title}`).click({ button: 'right' });
    await this.dashboard.get().locator('div.nc-project-menu-item:has-text("Delete")').click();

    await this.waitForResponse({
      uiAction: this.dashboard.get().locator('button:has-text("Yes")').click(),
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

  async validateRoleAccess(param: { role: string }) {
    // Add new table button
    await expect(this.get().locator(`.nc-add-new-table`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Import menu
    await expect(this.get().locator(`.nc-import-menu`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Invite Team button
    await expect(this.get().locator(`.nc-share-base`)).toHaveCount(param.role === 'creator' ? 1 : 0);
    // Right click context menu
    await this.get().locator(`.nc-project-tree-tbl-Country`).click({
      button: 'right',
    });
    await expect(this.rootPage.locator(`.nc-dropdown-tree-view-context-menu:visible`)).toHaveCount(
      param.role === 'creator' ? 1 : 0
    );
  }
}
