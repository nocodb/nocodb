import { expect, Locator } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { DocsSidebarPage } from './DocsSidebar';

export class SidebarPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly docsSidebar: DocsSidebarPage;
  readonly quickImportButton: Locator;
  readonly createProjectBtn: Locator;
  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.docsSidebar = new DocsSidebarPage(this);
    this.quickImportButton = dashboard.get().locator('.nc-import-menu');
    this.createProjectBtn = dashboard.get().locator('.nc-create-project-btn');
  }

  get() {
    return this.dashboard.get().locator('.nc-treeview-container');
  }

  async isVisible() {
    return await this.get().isVisible();
  }

  async verifyVisibility({ isVisible }: { isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get()).toBeVisible();
    } else {
      await expect(this.get()).not.toBeVisible();
    }
  }

  async openProject({ title, mode = 'standard' }: { title: string; mode?: string }) {
    await this.get().locator(`.project-title-node`).getByText(title).click();

    // TODO: Fix this
    await this.rootPage.waitForTimeout(1000);
  }

  async createProject({ title, type }: { title: string; type: ProjectTypes }) {
    await this.createProjectBtn.click();
    if (type === ProjectTypes.DOCUMENTATION) {
      await this.dashboard.get().locator('.nc-create-project-btn-docs').click();
    }
    await this.dashboard.get().locator('.nc-metadb-project-name').clear();
    await this.dashboard.get().locator('.nc-metadb-project-name').fill(title);

    await this.waitForResponse({
      uiAction: () => this.dashboard.get().getByTestId('docs-create-proj-dlg-create-btn').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `api/v1/db/meta/projects/`,
    });
    await this.dashboard.docs.pagesList.waitForOpen({ title });
  }
}
