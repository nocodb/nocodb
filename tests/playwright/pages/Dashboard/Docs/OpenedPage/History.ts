import { expect } from '@playwright/test';
import { DocsOpenedPagePage } from '.';
import BasePage from '../../../Base';

/**
 * Page object for the doc revision history flow.
 *
 * Single modal: a list pane on the right + a diff viewer pane on the left,
 * with Restore + diff controls in the modal header. Restore confirms via
 * NcConfirmModal.
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

  modal() {
    return this.rootPage.getByTestId('nc-doc-history-modal');
  }

  list() {
    return this.rootPage.getByTestId('nc-doc-history-list');
  }

  /** A row in the list — one per revision. */
  listItem(revisionId: string) {
    return this.rootPage.getByTestId(`nc-doc-history-item-${revisionId}`);
  }

  listItems() {
    return this.rootPage.locator('[data-testid^="nc-doc-history-item-"]');
  }

  restoreButton() {
    return this.rootPage.getByTestId('nc-doc-history-restore-btn');
  }

  closeButton() {
    return this.rootPage.getByTestId('nc-doc-history-close-btn');
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
    await this.verifyModalVisible(true);
  }

  async clickRevisionAt(index: number) {
    await this.listItems().nth(index).click();
  }

  async restoreSelectedRevision() {
    // Restore is disabled when the selected revision IS the current version
    // (topmost row). Caller must first click a prior revision via
    // clickRevisionAt(i >= 1) for this to be enabled.
    await expect(this.restoreButton()).toBeEnabled();
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

  async verifyModalVisible(visible: boolean) {
    await this.modal().waitFor({ state: visible ? 'visible' : 'hidden' });
  }

  async verifyRevisionCount(count: number) {
    await expect(this.listItems()).toHaveCount(count);
  }

  /**
   * Waits until at least `min` revisions are listed. Less brittle than
   * `verifyRevisionCount` when the initial doc save may or may not produce
   * a separate row depending on backend coalesce settings.
   */
  async verifyMinRevisionCount(min: number) {
    await expect(this.listItems().nth(min - 1)).toBeVisible();
  }

  async verifyChangeNavLabel(label: string) {
    await expect(this.changeNav()).toContainText(label);
  }
}
