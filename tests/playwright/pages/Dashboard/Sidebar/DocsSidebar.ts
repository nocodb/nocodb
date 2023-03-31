import { expect, Locator } from '@playwright/test';
import { SidebarPage } from '.';
import BasePage from '../../Base';

export class DocsSidebarPage extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(sidebar: SidebarPage) {
    super(sidebar.rootPage);
    this.sidebar = sidebar;
  }

  get({ projectTitle, isPublic }: { projectTitle: string; isPublic?: boolean }) {
    if (isPublic) {
      return this.rootPage.getByTestId(`docs-sidebar-${projectTitle}`);
    }
    return this.sidebar.get().getByTestId(`docs-sidebar-${projectTitle}`);
  }

  async verifyVisibility({
    projectTitle,
    isVisible,
    isPublic,
  }: {
    projectTitle: string;
    isVisible: boolean;
    isPublic?: boolean;
  }) {
    if (isVisible) {
      await expect(this.get({ projectTitle, isPublic })).toBeVisible();
    } else {
      await expect(this.get({ projectTitle, isPublic })).not.toBeVisible();
    }
  }

  async createPage({ projectTitle, title, content }: { projectTitle: string; title?: string; content?: string }) {
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
    if (content) {
      await this.sidebar.dashboard.docs.openedPage.fillContent({ content });
    }
  }

  async createChildPage({
    projectTitle,
    title,
    parentTitle,
    content,
  }: {
    projectTitle: string;
    title?: string;
    parentTitle: string;
    content?: string;
  }) {
    await this.openPage({ projectTitle, title: parentTitle });

    await this.get({ projectTitle })
      .getByTestId(`docs-sidebar-page-${projectTitle}-${parentTitle}`)
      .locator('.nc-docs-sidebar-page-title')
      .hover();
    const createChildPageButton = this.get({ projectTitle })
      .getByTestId(`docs-sidebar-page-${projectTitle}-${parentTitle}`)
      .locator('.nc-docs-add-child-page');
    await createChildPageButton.hover();
    await createChildPageButton.waitFor({ state: 'visible' });

    await this.rootPage.waitForTimeout(1000);

    await this.waitForResponse({
      uiAction: () =>
        createChildPageButton.click({
          force: true,
        }),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();

    if (title) {
      await this.sidebar.dashboard.docs.openedPage.fillTitle({ title });
    }
    if (content) {
      await this.sidebar.dashboard.docs.openedPage.fillContent({ content });
    }
  }

  async verifyPageInSidebar({
    projectTitle,
    title,
    level,
    isPublic,
  }: {
    projectTitle: string;
    title: string;
    level?: number;
    isPublic?: boolean;
  }) {
    await expect(
      this.get({ projectTitle, isPublic }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
    ).toBeVisible();

    if (level) {
      await expect(
        this.get({ projectTitle, isPublic }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
      ).toHaveAttribute('data-level', level.toString());
    }
  }

  async verifyPageIsNotInSidebar({
    projectTitle,
    title,
    isPublic,
  }: {
    projectTitle: string;
    title: string;
    isPublic?: boolean;
  }) {
    await expect(
      this.get({ projectTitle, isPublic }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
    ).toBeHidden();
  }

  async openPage({ projectTitle, title }: { projectTitle: string; title: string }) {
    if ((await this.getTitleOfOpenedPage({ projectTitle })) === title) {
      return;
    }

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

  async getTitleOfOpenedPage({
    projectTitle,
    isPublic,
  }: {
    projectTitle: string;
    isPublic?: boolean;
  }): Promise<string | null> {
    return await this.get({ projectTitle, isPublic })
      .locator('.ant-tree-node-selected')
      .locator('.nc-docs-sidebar-page-title')
      .textContent();
  }
}
