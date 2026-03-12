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
   * Ensures the MiniSidebarV2 docs tab is active before interacting with the docs sidebar.
   * No-op if V2 is not present or docs tab is already active.
   */
  private async ensureDocsTab(): Promise<void> {
    await this.sidebar.dashboard.leftSidebar.sidebarNav.navigateToDocsTab();
  }

  /**
   * Get the documents list container in the sidebar.
   * If isPublic, scopes to the public docs sidebar; otherwise scopes to the main sidebar.
   */
  get({ baseTitle, isPublic }: { baseTitle: string; isPublic?: boolean }) {
    if (isPublic) {
      return this.rootPage.getByTestId(`docs-sidebar-${baseTitle}`);
    }
    return this.sidebar.get().getByTestId('nc-docs-sidebar-pages-list');
  }

  /**
   * Locate a specific document node by its title in the sidebar.
   * Node.vue uses data-testid="view-sidebar-doc-${doc.title}".
   */
  documentNodeLocator({ baseTitle, title, isPublic }: { baseTitle: string; title: string; isPublic?: boolean }) {
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
    await this.ensureDocsTab();
    if (isVisible) {
      await expect(this.get({ baseTitle, isPublic })).toBeVisible();
    } else {
      await expect(this.get({ baseTitle, isPublic })).not.toBeVisible();
    }
  }

  async createDocument({ baseTitle, title, content }: { baseTitle: string; title?: string; content?: string }) {
    await this.ensureDocsTab();

    const createNewBtn = this.rootPage.getByTestId('nc-home-create-new-btn');

    await this.waitForResponse({
      uiAction: () => createNewBtn.click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `operation=documentCreate`,
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

  async verifyDocumentInSidebar({
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
    await this.ensureDocsTab();
    await expect(this.documentNodeLocator({ baseTitle, title, isPublic })).toBeVisible();
  }

  async verifyDocumentIsNotInSidebar({
    baseTitle,
    title,
    isPublic,
  }: {
    baseTitle: string;
    title: string;
    isPublic?: boolean;
  }) {
    await this.ensureDocsTab();
    await expect(this.documentNodeLocator({ baseTitle, title, isPublic })).toBeHidden();
  }

  async openDocument({ baseTitle, title }: { baseTitle: string; title: string }) {
    await this.ensureDocsTab();

    const node = this.documentNodeLocator({ baseTitle, title });

    await this.waitForResponse({
      uiAction: () => node.getByTestId('sidebar-doc-title').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `operation=documentGet`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();
  }

  async deleteDocument({ baseTitle, title }: { baseTitle: string; title: string }) {
    await this.ensureDocsTab();

    const node = this.documentNodeLocator({ baseTitle, title });

    await node.hover();

    // Click the 3-dot context menu button
    await node.getByTestId('docs-sidebar-page-options').click();

    // Click "Delete" in the context menu
    await this.rootPage.getByTestId(`sidebar-doc-delete-${title}`).click();

    // Confirm deletion in the confirm modal
    await this.rootPage.getByTestId('nc-delete-modal-delete-btn').click();

    await this.rootPage.waitForTimeout(300);
  }

  /**
   * Get the title of the currently active (selected) document in the sidebar.
   * Active documents have the `.active` class on the nc-document-item wrapper.
   */
  async getTitleOfOpenedDocument({
    baseTitle,
    isPublic,
  }: {
    baseTitle: string;
    isPublic?: boolean;
  }): Promise<string | null> {
    await this.ensureDocsTab();

    const activeNode = this.get({ baseTitle, isPublic }).locator('.nc-document-item.active');
    if (!(await activeNode.isVisible().catch(() => false))) {
      return null;
    }

    return await activeNode.getByTestId('sidebar-doc-title').textContent();
  }

  async createSubDocument({ baseTitle, parentTitle }: { baseTitle: string; parentTitle: string }) {
    await this.ensureDocsTab();

    const node = this.documentNodeLocator({ baseTitle, title: parentTitle });

    await node.hover();
    await node.getByTestId('docs-sidebar-page-options').click();

    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId(`sidebar-doc-create-sub-${parentTitle}`).click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `operation=documentCreate`,
    });

    // Wait for navigation to the newly created sub-document
    await this.sidebar.dashboard.docs.openedPage.waitForRender();
    // Extra wait for editor to settle after navigation
    await this.rootPage.waitForTimeout(500);
  }

  async duplicateDocument({ baseTitle, title }: { baseTitle: string; title: string }) {
    await this.ensureDocsTab();

    const node = this.documentNodeLocator({ baseTitle, title });

    await node.hover();
    await node.getByTestId('docs-sidebar-page-options').click();

    await this.waitForResponse({
      uiAction: () => this.rootPage.getByTestId(`sidebar-doc-duplicate-${title}`).click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `operation=documentCreate`,
    });

    await this.rootPage.waitForTimeout(500);
  }

  async verifyCreateDocumentButtonVisibility({ baseTitle, isVisible }: { baseTitle: string; isVisible: boolean }) {
    await this.ensureDocsTab();
    if (isVisible) {
      await expect(this.rootPage.getByTestId('nc-home-create-new-btn')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('nc-home-create-new-btn')).toBeHidden();
    }
  }
}
