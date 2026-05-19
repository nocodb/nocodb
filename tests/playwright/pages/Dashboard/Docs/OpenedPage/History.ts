import { expect } from '@playwright/test';
import { DocsOpenedPagePage } from '.';
import BasePage from '../../../Base';

/**
 * Page object for the doc revision history flow.
 *
 * Surfaces: a list panel docked on the right of the editor, and a preview
 * modal that opens when the user clicks a revision. Restore lives on the
 * modal header and confirms via NcConfirmModal.
 */
export class DocsHistoryPage extends BasePage {
  readonly openedPage: DocsOpenedPagePage;

  constructor(openedPage: DocsOpenedPagePage) {
    super(openedPage.rootPage);
    this.openedPage = openedPage;
  }

  get() {
    return this.openedPage.get();
  }

  // ── Locators ──────────────────────────────────────────────

  pageMenuButton() {
    return this.get().getByTestId('nc-doc-page-menu-btn');
  }

  historyMenuItem() {
    return this.rootPage.getByTestId('nc-doc-page-history');
  }

  sidebar() {
    return this.rootPage.getByTestId('nc-doc-history-sidebar');
  }

  /** A row in the history sidebar list — one per revision. */
  sidebarItem(revisionId: string) {
    return this.rootPage.getByTestId(`nc-doc-history-item-${revisionId}`);
  }

  sidebarItems() {
    return this.rootPage.locator('[data-testid^="nc-doc-history-item-"]');
  }

  restoreButton() {
    return this.rootPage.getByTestId('nc-doc-history-restore-btn');
  }

  highlightToggle() {
    return this.rootPage.getByTestId('nc-doc-history-highlight-toggle');
  }

  changeNav() {
    return this.rootPage.getByTestId('nc-doc-history-change-nav');
  }

  nextChangeButton() {
    return this.rootPage.getByTestId('nc-doc-history-next-change');
  }

  prevChangeButton() {
    return this.rootPage.getByTestId('nc-doc-history-prev-change');
  }

  // ── Actions ───────────────────────────────────────────────

  async openHistory() {
    await this.pageMenuButton().click();
    await this.historyMenuItem().click();
    await this.verifySidebarVisible(true);
  }

  async clickRevisionAt(index: number) {
    await this.sidebarItems().nth(index).click();
  }

  async restoreSelectedRevision() {
    await this.restoreButton().click();
    // NcConfirmModal — click "Restore" in the warning dialog.
    await this.rootPage.getByRole('button', { name: 'Restore' }).last().click();
  }

  async nextChange() {
    await this.nextChangeButton().click();
  }

  async prevChange() {
    await this.prevChangeButton().click();
  }

  // ── Assertions ────────────────────────────────────────────

  async verifySidebarVisible(visible: boolean) {
    await this.sidebar().waitFor({ state: visible ? 'visible' : 'hidden' });
  }

  async verifyRevisionCount(count: number) {
    await expect(this.sidebarItems()).toHaveCount(count);
  }

  async verifyChangeNavLabel(label: string) {
    await expect(this.changeNav()).toContainText(label);
  }
}
