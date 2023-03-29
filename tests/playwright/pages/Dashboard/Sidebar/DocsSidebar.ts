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

  async fillTitle({ projectTitle, title }: { projectTitle: string; title: string }) {
    await this.get({ projectTitle }).getByTestId('nc-docs-sidebar-page-title').fill(title);
  }

  async createPage({ projectTitle, title }: { projectTitle: string; title?: string }) {
    await this.waitForResponse({
      uiAction: () => this.get({ projectTitle }).getByTestId('nc-docs-sidebar-add-page').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();

    if (title) {
      await this.fillTitle({ projectTitle, title });
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
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();

    if (title) {
      await this.fillTitle({ projectTitle, title });
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

  async openPage({ projectTitle, title, mode = 'standard' }: { projectTitle: string; title: string; mode?: string }) {
    if ((await this.get({ projectTitle }).locator('.active.nc-project-tree-tbl').count()) > 0) {
      if ((await this.get({ projectTitle }).locator('.active.nc-project-tree-tbl').innerText()) === title) {
        // table already open
        return;
      }
    }

    await this.waitForResponse({
      uiAction: () => this.get({ projectTitle }).locator(`.nc-project-tree-tbl-${title}`).click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco/`,
      responseJsonMatcher: json => json.pageInfo,
    });
    await this.sidebar.dashboard.waitForTabRender({ title, mode });
  }

  async getTitleOfOpenedPage({ projectTitle }: { projectTitle: string }): Promise<string | null> {
    return await this.get({ projectTitle })
      .locator('.ant-tree-node-selected')
      .locator('.nc-docs-sidebar-page-title')
      .textContent();
  }
}
