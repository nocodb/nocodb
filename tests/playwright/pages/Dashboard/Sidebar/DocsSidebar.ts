import { expect } from '@playwright/test';
import { SidebarPage } from '.';
import BasePage from '../../Base';

export class DocsSidebarPage extends BasePage {
  readonly sidebar: SidebarPage;

  constructor(sidebar: SidebarPage) {
    super(sidebar.rootPage);
    this.sidebar = sidebar;
  }

  /**
   * Get the pages list container in the sidebar.
   * If isPublic, scopes to the public docs sidebar; otherwise scopes to the main sidebar.
   */
  get({ baseTitle, isPublic }: { baseTitle: string; isPublic?: boolean }) {
    if (isPublic) {
      return this.rootPage.getByTestId(`docs-sidebar-${baseTitle}`);
    }
    return this.sidebar.get().getByTestId('nc-docs-sidebar-pages-list');
  }

  /**
   * Locate a specific page node by its title in the sidebar.
   * Node.vue uses data-testid="view-sidebar-doc-${doc.title}".
   */
  pageNodeLocator({ baseTitle, title, isPublic }: { baseTitle: string; title: string; isPublic?: boolean }) {
    return this.get({ baseTitle, isPublic }).getByTestId(`view-sidebar-doc-${title}`);
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
    const addPageBtn = this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page');

    // If no pages exist yet, the button is visible directly.
    // If pages exist, we don't have an add-page button in the list itself —
    // pages are created via the API or the sidebar "+" button.
    // For now, try clicking the add page button if it's visible.
    const isAddBtnVisible = await addPageBtn.isVisible().catch(() => false);

    if (isAddBtnVisible) {
      await this.waitForResponse({
        uiAction: () => addPageBtn.click(),
        httpMethodsToMatch: ['POST'],
        requestUrlPathToMatch: `operation=docCreate`,
      });
    }

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

  async verifyPageInSidebar({
    baseTitle,
    title,
    isPublic,
  }: {
    baseTitle: string;
    title: string;
    level?: number;
    isPublic?: boolean;
    emoji?: string;
  }) {
    await expect(this.pageNodeLocator({ baseTitle, title, isPublic })).toBeVisible();
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
    await expect(this.pageNodeLocator({ baseTitle, title, isPublic })).toBeHidden();
  }

  async openPage({ baseTitle, title }: { baseTitle: string; title: string }) {
    const node = this.pageNodeLocator({ baseTitle, title });

    await this.waitForResponse({
      uiAction: () => node.getByTestId('sidebar-doc-title').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `operation=docGet`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();
  }

  async deletePage({ baseTitle, title }: { baseTitle: string; title: string }) {
    const node = this.pageNodeLocator({ baseTitle, title });

    await node.hover();

    // Click the 3-dot context menu button
    await node.getByTestId('docs-sidebar-page-options').click();

    // Click "Delete" in the context menu
    await this.rootPage.getByTestId(`sidebar-doc-delete-${title}`).click();

    // Confirm deletion in the confirm modal
    await this.rootPage.locator('.nc-modal-confirm-ok-btn').click();

    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Get the title of the currently active (selected) page in the sidebar.
   * Active pages have the `.active` class on the nc-page-item wrapper.
   */
  async getTitleOfOpenedPage({
    baseTitle,
    isPublic,
  }: {
    baseTitle: string;
    isPublic?: boolean;
  }): Promise<string | null> {
    const activeNode = this.get({ baseTitle, isPublic }).locator('.nc-page-item.active');
    if (!(await activeNode.isVisible().catch(() => false))) {
      return null;
    }

    return await activeNode.getByTestId('sidebar-doc-title').textContent();
  }

  async verifyCreatePageButtonVisibility({ baseTitle, isVisible }: { baseTitle: string; isVisible: boolean }) {
    if (isVisible) {
      await expect(this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page')).toBeVisible();
    } else {
      await expect(this.get({ baseTitle }).getByTestId('nc-docs-sidebar-add-page')).toBeHidden();
    }
  }
}
