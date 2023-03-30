import { expect, Locator } from '@playwright/test';
import { SidebarPage } from '.';
import BasePage from '../../Base';

export class DocsSidebarPage extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(sidebar: SidebarPage) {
    super(sidebar.rootPage);
    this.sidebar = sidebar;
  }

  get({ projectTitle }: { projectTitle: string }) {
    return this.sidebar.get().getByTestId(`docs-sidebar-${projectTitle}`);
  }

  async createPage({ projectTitle, title }: { projectTitle: string; title?: string }) {
    await this.get({ projectTitle }).getByTestId('nc-docs-sidebar-add-page').hover();

    await this.waitForResponse({
      uiAction: () => this.get({ projectTitle }).getByTestId('nc-docs-sidebar-add-page').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();

    if (title) {
      await this.sidebar.dashboard.docs.openedPage.fillTitle({ title });
    }
  }

  async createChildPage({
    projectTitle,
    title,
    parentTitle,
  }: {
    projectTitle: string;
    title?: string;
    parentTitle: string;
  }) {
    await this.get({ projectTitle }).getByTestId(`docs-sidebar-page-${projectTitle}-${parentTitle}`).hover();
    await this.waitForResponse({
      uiAction: () =>
        this.get({ projectTitle })
          .getByTestId(`docs-sidebar-page-${projectTitle}-${parentTitle}`)
          .locator('.nc-docs-add-child-page')
          .click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `api/v1/docs/page`,
      debug: true,
      debugKey: 'createChildPage',
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();

    if (title) {
      await this.sidebar.dashboard.docs.openedPage.fillTitle({ title });
      console.log('createChildPage:1');
    }
  }

  async verifyPageInSidebar({ projectTitle, title, level }: { projectTitle: string; title: string; level?: number }) {
    await expect(this.get({ projectTitle }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)).toBeVisible();

    if (level) {
      await expect(
        this.get({ projectTitle }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
      ).toHaveAttribute('data-level', level.toString());
    }
  }

  async openPage({ projectTitle, title }: { projectTitle: string; title: string }) {
    await this.waitForResponse({
      uiAction: () =>
        this.get({ projectTitle })
          .getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
          .locator('.nc-docs-sidebar-page-title')
          .click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();
  }

  async getTitleOfOpenedPage({ projectTitle }: { projectTitle: string }): Promise<string | null> {
    return await this.get({ projectTitle })
      .locator('.ant-tree-node-selected')
      .locator('.nc-docs-sidebar-page-title')
      .textContent();
  }
}
