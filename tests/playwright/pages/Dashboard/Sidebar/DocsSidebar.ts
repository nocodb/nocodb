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
   * Ensures the data tab is active (documents now live in the data tab).
   */
  private async ensureDataTab(): Promise<void> {
    await this.sidebar.dashboard.leftSidebar.sidebarNav.navigateToDataTab();
  }

  /**
   * Get the sidebar container where document nodes are rendered.
   * Documents are now in the data sidebar alongside tables and dashboards.
   */
  get({ baseTitle, isPublic }: { baseTitle: string; isPublic?: boolean }) {
    if (isPublic) {
      return this.rootPage.getByTestId(`docs-sidebar-${baseTitle}`);
    }
    return this.sidebar.get();
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
    await this.ensureDataTab();
    if (isVisible) {
      await expect(this.get({ baseTitle, isPublic })).toBeVisible();
    } else {
      await expect(this.get({ baseTitle, isPublic })).not.toBeVisible();
    }
  }

  async createDocument({ baseTitle, title, content }: { baseTitle: string; title?: string; content?: string }) {
    await this.ensureDataTab();

    // Click the "Create New" dropdown button
    const createNewBtn = this.rootPage.getByTestId('nc-home-create-new-btn');
    await createNewBtn.click();

    // Select "Document" from the dropdown
    const documentOption = this.rootPage.getByTestId('create-new-document');

    await this.waitForResponse({
      uiAction: () => documentOption.click(),
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
    await this.ensureDataTab();
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
    await this.ensureDataTab();
    await expect(this.documentNodeLocator({ baseTitle, title, isPublic })).toBeHidden();
  }

  async openDocument({ baseTitle, title }: { baseTitle: string; title: string }) {
    await this.ensureDataTab();

    const node = this.documentNodeLocator({ baseTitle, title });

    await this.waitForResponse({
      uiAction: () => node.getByTestId('sidebar-doc-title').click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `operation=documentGet`,
    });

    await this.sidebar.dashboard.docs.openedPage.waitForRender();
  }

  async deleteDocument({ baseTitle, title }: { baseTitle: string; title: string }) {
    await this.ensureDataTab();

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
   */
  async getTitleOfOpenedDocument({
    baseTitle,
    isPublic,
  }: {
    baseTitle: string;
    isPublic?: boolean;
  }): Promise<string | null> {
    await this.ensureDataTab();

    const activeNode = this.get({ baseTitle, isPublic }).locator('.nc-document-item.active');
    if (!(await activeNode.isVisible().catch(() => false))) {
      return null;
    }

    return await activeNode.getByTestId('sidebar-doc-title').textContent();
  }

  async createSubDocument({ baseTitle, parentTitle }: { baseTitle: string; parentTitle: string }) {
    await this.ensureDataTab();

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
    await this.ensureDataTab();

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
    await this.ensureDataTab();
    if (isVisible) {
      await expect(this.rootPage.getByTestId('nc-home-create-new-btn')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('nc-home-create-new-btn')).toBeHidden();
    }
  }
}
