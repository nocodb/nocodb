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

  pageNodeLocator({ projectTitle, title, isPublic }: { projectTitle: string; title: string; isPublic?: boolean }) {
    return this.get({ projectTitle, isPublic }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`);
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
      await this.rootPage.waitForTimeout(400);
    }
    if (content) {
      await this.sidebar.dashboard.docs.openedPage.tiptap.fillContent({ content });
      await this.rootPage.waitForTimeout(400);
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
      await this.sidebar.dashboard.docs.openedPage.tiptap.fillContent({ content });
    }
  }

  async verifyPageInSidebar({
    projectTitle,
    title,
    level,
    isPublic,
    emoji,
  }: {
    projectTitle: string;
    title: string;
    level?: number;
    isPublic?: boolean;
    emoji?: string;
  }) {
    await expect(
      this.get({ projectTitle, isPublic }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
    ).toBeVisible();

    if (level) {
      await expect(
        this.get({ projectTitle, isPublic }).getByTestId(`docs-sidebar-page-${projectTitle}-${title}`)
      ).toHaveAttribute('data-level', level.toString());
    }

    if (emoji) {
      await this.verifyEmoji({ projectTitle, title, emoji, isPublic });
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

  async selectEmoji({ projectTitle, title, emoji }: { projectTitle: string; title; emoji: string }) {
    await this.openPage({ projectTitle, title });

    await this.pageNodeLocator({
      projectTitle,
      title,
    })
      .getByTestId('docs-sidebar-emoji-selector')
      .hover();
    await this.pageNodeLocator({
      projectTitle,
      title,
    })
      .getByTestId('docs-sidebar-emoji-selector')
      .click();

    await this.rootPage.getByTestId('nc-emoji-filter').last().type(emoji);

    await this.rootPage.waitForTimeout(500);

    await this.waitForResponse({
      uiAction: () =>
        this.rootPage.getByTestId('nc-emoji-container').last().locator(`.nc-emoji-item >> svg`).first().click(),
      httpMethodsToMatch: ['PUT'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });
  }

  async verifyEmoji({
    projectTitle,
    title,
    emoji,
    isPublic,
  }: {
    projectTitle: string;
    title;
    emoji: string;
    isPublic?: boolean;
  }) {
    await expect(
      this.pageNodeLocator({
        projectTitle,
        title,
        isPublic,
      }).getByTestId(`nc-doc-page-icon-emojione:${emoji}`)
    ).toBeVisible();
  }

  async deletePage({ projectTitle, title }: { projectTitle: string; title: string }) {
    await this.openPage({ projectTitle, title });

    await this.pageNodeLocator({
      projectTitle,
      title,
    }).hover();

    await this.pageNodeLocator({
      projectTitle,
      title,
    })
      .getByTestId('docs-sidebar-page-options')
      .hover();

    await this.pageNodeLocator({
      projectTitle,
      title,
    })
      .getByTestId('docs-sidebar-page-options')
      .click();

    await this.rootPage.getByTestId('docs-sidebar-page-delete').click();

    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId('docs-page-delete-confirmation').last().click(),
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });
  }

  async getTitleOfOpenedPage({
    projectTitle,
    isPublic,
  }: {
    projectTitle: string;
    isPublic?: boolean;
  }): Promise<string | null> {
    if (!(await this.get({ projectTitle, isPublic }).locator('.ant-tree-node-selected').isVisible())) {
      return null;
    }

    return await this.get({ projectTitle, isPublic })
      .locator('.ant-tree-node-selected')
      .locator('.nc-docs-sidebar-page-title')
      .textContent();
  }

  async verifyParent({
    projectTitle,
    title,
    parentTitle,
    parentLevel,
  }: {
    projectTitle: string;
    title: string;
    parentTitle: string;
    parentLevel: number;
  }) {
    await this.verifyPageInSidebar({
      projectTitle,
      title,
      level: parentLevel + 1,
    });

    await this.verifyPageInSidebar({
      projectTitle,
      title: parentTitle,
      level: parentLevel,
    });
  }

  async verifyCreatePageButtonVisibility({ projectTitle, isVisible }: { projectTitle: string; isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get({ projectTitle }).getByTestId('nc-docs-sidebar-add-page')).toBeVisible();
    } else {
      await expect(this.get({ projectTitle }).getByTestId('nc-docs-sidebar-add-page')).toBeHidden();
    }
  }

  async reorderPage({
    projectTitle,
    title,
    newParentTitle,
    dragToTop,
  }: {
    projectTitle: string;
    title: string;
    newParentTitle: string;
    dragToTop?: boolean;
  }) {
    await this.openPage({ projectTitle, title });

    await this.pageNodeLocator({
      projectTitle,
      title,
    }).hover();

    await this.pageNodeLocator({
      projectTitle,
      title,
    }).dragTo(
      this.pageNodeLocator({
        projectTitle,
        title: newParentTitle,
      }),
      {
        targetPosition: {
          x: 135,
          y: dragToTop ? 0 : 20,
        },
        force: true,
      }
    );
  }
}
