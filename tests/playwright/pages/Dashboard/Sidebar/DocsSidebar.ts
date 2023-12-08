import { expect } from '@playwright/test';
import { SidebarPage } from '.';
import BasePage from '../../Base';

export class DocsSidebarPage extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(sidebar: SidebarPage) {
    super(sidebar.rootPage);
    this.sidebar = sidebar;
  }

  get({ baseTitle, isPublic }: { baseTitle: string; isPublic?: boolean }) {
    if (isPublic) {
      return this.rootPage.getByTestId(`docs-sidebar-${baseTitle}`);
    }
    return this.sidebar.get().getByTestId(`docs-sidebar-${baseTitle}`);
  }

  pageNodeLocator({ baseTitle, title, isPublic }: { baseTitle: string; title: string; isPublic?: boolean }) {
    return this.get({ baseTitle, isPublic }).getByTestId(`docs-sidebar-page-${baseTitle}-${title}`);
  }

  async verifyVisibility({
    baseTitle,
    isVisible,
    isPublic,
  }: {
    baseTitle: string;
    isVisible: boolean;
    isPublic?: boolean;
  }) {
    if (isVisible) {
      await expect(this.get({ baseTitle, isPublic })).toBeVisible();
    } else {
      await expect(this.get({ baseTitle, isPublic })).not.toBeVisible();
    }
  }

  async createPage({ baseTitle, title, content }: { baseTitle: string; title?: string; content?: string }) {
    await this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page').hover();

    await this.waitForResponse({
      uiAction: () => this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page').click(),
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
    baseTitle,
    title,
    parentTitle,
    content,
  }: {
    baseTitle: string;
    title?: string;
    parentTitle: string;
    content?: string;
  }) {
    await this.openPage({ baseTitle, title: parentTitle });

    await this.get({ baseTitle })
      .getByTestId(`docs-sidebar-page-${baseTitle}-${parentTitle}`)
      .locator('.nc-docs-sidebar-page-title')
      .hover();
    const createChildPageButton = this.get({ baseTitle })
      .getByTestId(`docs-sidebar-page-${baseTitle}-${parentTitle}`)
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
    baseTitle,
    title,
    level,
    isPublic,
    emoji,
  }: {
    baseTitle: string;
    title: string;
    level?: number;
    isPublic?: boolean;
    emoji?: string;
  }) {
    await expect(
      this.get({ baseTitle, isPublic }).getByTestId(`docs-sidebar-page-${baseTitle}-${title}`)
    ).toBeVisible();

    if (level) {
      await expect(
        this.get({ baseTitle, isPublic }).getByTestId(`docs-sidebar-page-${baseTitle}-${title}`)
      ).toHaveAttribute('data-level', level.toString());
    }

    if (emoji) {
      await this.verifyEmoji({ baseTitle, title, emoji, isPublic });
    }
  }

  async verifyPageIsNotInSidebar({
    baseTitle,
    title,
    isPublic,
  }: {
    baseTitle: string;
    title: string;
    isPublic?: boolean;
  }) {
    await expect(this.get({ baseTitle, isPublic }).getByTestId(`docs-sidebar-page-${baseTitle}-${title}`)).toBeHidden();
  }

  async openPage({ baseTitle, title }: { baseTitle: string; title: string }) {
    if ((await this.getTitleOfOpenedPage({ baseTitle })) === title) {
      return;
    }

    await this.waitForResponse({
      uiAction: () =>
        this.get({ baseTitle })
          .getByTestId(`docs-sidebar-page-${baseTitle}-${title}`)
          .locator('.nc-docs-sidebar-page-title')
          .click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();
  }

  async selectEmoji({ baseTitle, title, emoji }: { baseTitle: string; title; emoji: string }) {
    await this.openPage({ baseTitle, title });

    await this.pageNodeLocator({
      baseTitle,
      title,
    })
      .getByTestId('docs-sidebar-emoji-selector')
      .hover();
    await this.pageNodeLocator({
      baseTitle,
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
    baseTitle,
    title,
    emoji,
    isPublic,
  }: {
    baseTitle: string;
    title;
    emoji: string;
    isPublic?: boolean;
  }) {
    await expect(
      this.pageNodeLocator({
        baseTitle,
        title,
        isPublic,
      }).getByTestId(`nc-doc-page-icon-emojione:${emoji}`)
    ).toBeVisible();
  }

  async deletePage({ baseTitle, title }: { baseTitle: string; title: string }) {
    await this.openPage({ baseTitle, title });

    await this.pageNodeLocator({
      baseTitle,
      title,
    }).hover();

    await this.pageNodeLocator({
      baseTitle,
      title,
    })
      .getByTestId('docs-sidebar-page-options')
      .hover();

    await this.pageNodeLocator({
      baseTitle,
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
    baseTitle,
    isPublic,
  }: {
    baseTitle: string;
    isPublic?: boolean;
  }): Promise<string | null> {
    if (!(await this.get({ baseTitle, isPublic }).locator('.ant-tree-node-selected').isVisible())) {
      return null;
    }

    return await this.get({ baseTitle, isPublic })
      .locator('.ant-tree-node-selected')
      .locator('.nc-docs-sidebar-page-title')
      .textContent();
  }

  async verifyParent({
    baseTitle,
    title,
    parentTitle,
    parentLevel,
  }: {
    baseTitle: string;
    title: string;
    parentTitle: string;
    parentLevel: number;
  }) {
    await this.verifyPageInSidebar({
      baseTitle,
      title,
      level: parentLevel + 1,
    });

    await this.verifyPageInSidebar({
      baseTitle,
      title: parentTitle,
      level: parentLevel,
    });
  }

  async verifyCreatePageButtonVisibility({ baseTitle, isVisible }: { baseTitle: string; isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page')).toBeVisible();
    } else {
      await expect(this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page')).toBeHidden();
    }
  }

  async reorderPage({
    baseTitle,
    title,
    newParentTitle,
    dragToTop,
  }: {
    baseTitle: string;
    title: string;
    newParentTitle: string;
    dragToTop?: boolean;
  }) {
    await this.openPage({ baseTitle, title });

    await this.pageNodeLocator({
      baseTitle,
      title,
    }).hover();

    await this.pageNodeLocator({
      baseTitle,
      title,
    }).dragTo(
      this.pageNodeLocator({
        baseTitle,
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
