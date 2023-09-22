import { expect, Locator } from '@playwright/test';
import { ProjectTypes, ViewTypes } from 'nocodb-sdk';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { DocsSidebarPage } from './DocsSidebar';
import { SidebarUserMenuObject } from './UserMenu';

export class SidebarPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly docsSidebar: DocsSidebarPage;
  readonly quickImportButton: Locator;
  readonly createProjectBtn: Locator;
  readonly userMenu: SidebarUserMenuObject;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.docsSidebar = new DocsSidebarPage(this);
    this.userMenu = new SidebarUserMenuObject(this);
    this.quickImportButton = dashboard.get().locator('.nc-import-menu');
    this.createProjectBtn = dashboard.get().locator('.nc-create-project-btn');
  }

  get() {
    return this.dashboard.get().locator('.nc-sidebar');
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

  async openProject({ title }: { title: string }) {
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

  async createView({ title, type }: { title: string; type: ViewTypes }) {
    const createViewButtonOfActiveProject = this.dashboard
      .get()
      .locator('.nc-table-node-wrapper[data-active="true"] .nc-create-view-btn');
    await createViewButtonOfActiveProject.scrollIntoViewIfNeeded();
    await createViewButtonOfActiveProject.click();

    // TODO: Find a better way to do it
    let createViewTypeButton: Locator;

    if (type === ViewTypes.GRID) {
      createViewTypeButton = this.rootPage.getByTestId('sidebar-view-create-grid');
    } else if (type === ViewTypes.FORM) {
      createViewTypeButton = this.rootPage.getByTestId('sidebar-view-create-form');
    } else if (type === ViewTypes.KANBAN) {
      createViewTypeButton = this.rootPage.getByTestId('sidebar-view-create-kanban');
    } else if (type === ViewTypes.GALLERY) {
      createViewTypeButton = this.rootPage.getByTestId('sidebar-view-create-gallery');
    }

    await this.rootPage.waitForTimeout(750);
    const allButtons = await createViewTypeButton.all();
    for (const btn of allButtons) {
      if (await btn.isVisible()) {
        createViewTypeButton = btn;
        break;
      }
    }

    await createViewTypeButton.click({
      force: true,
    });

    await this.rootPage.locator('input[id="form_item_title"]:visible').waitFor({ state: 'visible' });
    await this.rootPage.locator('input[id="form_item_title"]:visible').fill(title);
    const submitAction = () =>
      this.rootPage.locator('.ant-modal-content').locator('button.ant-btn.ant-btn-primary').click();
    await this.waitForResponse({
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/api/v1/db/meta/tables/',
      uiAction: submitAction,
      responseJsonMatcher: json => json.title === title,
    });
    // Todo: Wait for view to be rendered
    await this.rootPage.waitForTimeout(1000);
  }

  async verifyCreateViewButtonVisibility({ isVisible }: { isVisible: boolean }) {
    const createViewButtonOfActiveProject = this.dashboard
      .get()
      .locator('.nc-table-node-wrapper[data-active="true"] .nc-create-view-btn');

    if (isVisible) {
      await expect(createViewButtonOfActiveProject).toBeVisible();
    } else {
      await expect(createViewButtonOfActiveProject).toHaveCount(0);
    }
  }
}
