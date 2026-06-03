import { expect } from '@playwright/test';
import { DashboardPage } from '../..';
import BasePage from '../../../Base';
import { TiptapPage } from './Tiptap';
import { DocsHistoryPage } from './History';

export class DocsOpenedPagePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly tiptap: TiptapPage;
  readonly history: DocsHistoryPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.tiptap = new TiptapPage(this);
    this.history = new DocsHistoryPage(this);
  }

  get() {
    return this.dashboard.get().getByTestId('docs-opened-page');
  }

  async waitForRender() {
    await this.get().waitFor({ state: 'visible' });
    await this.get().getByTestId('docs-page-title').waitFor({ state: 'visible' });
    // Wait for ProseMirror to mount AND become editable (Tiptap fully initialized)
    await this.get()
      .getByTestId('docs-page-content')
      .locator('.ProseMirror[contenteditable="true"]')
      .first()
      .waitFor({ state: 'visible' });
    await this.get()
      .getByTestId('docs-page-title')
      .elementHandle()
      .then(async el => {
        await el?.waitForElementState('stable');
      });
  }

  async fillTitle({ title }: { title: string }) {
    await this.waitForRender();

    const titleInput = this.get().getByTestId('docs-page-title');

    await titleInput.click();

    await titleInput.press('ControlOrMeta+A');
    await titleInput.press('Backspace');

    await titleInput.type(title, { delay: 0 });

    // The title input is the source of truth in both modes. Legacy debounce-saves
    // it via REST (operation=documentUpdate); collab mode rides the shared Y.Doc
    // (no documentUpdate REST call), so wait for the value to be applied rather
    // than for a network response that does not occur under collab.
    await expect.poll(() => titleInput.inputValue()).toBe(title);
  }

  async verifyTitle({ title }: { title: string }) {
    await expect.poll(() => this.get().getByTestId('docs-page-title').inputValue()).toBe(title);
  }

  async verifyOpenedPageVisible() {
    await expect(this.get()).toBeVisible();
  }

  async selectEmoji({ emoji }: { emoji: string }) {
    await this.get().getByTestId('nc-doc-opened-page-icon-picker').hover();
    await this.get().getByTestId('nc-doc-opened-page-icon-picker').click();

    // emoji-mart-vue-fast renders its own search input
    const emojiSearch = this.rootPage.locator('.emoji-mart-search input').last();
    await emojiSearch.waitFor({ state: 'visible' });
    await emojiSearch.fill(emoji);

    await this.rootPage.waitForTimeout(500);

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.emoji-mart-category .emoji-mart-emoji').first().click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `operation=documentUpdate`,
    });
  }

  async verifyTitleIsReadOnly({ editable }: { editable: boolean }) {
    await expect(this.get().getByTestId('docs-page-title')).toBeEditable({
      editable: editable,
    });
  }

  async verifyContentIsReadOnly({ editable }: { editable: boolean }) {
    await expect(this.get().getByTestId('docs-page-content').locator('.ProseMirror').first()).toHaveAttribute(
      'contenteditable',
      editable ? 'true' : 'false'
    );
  }
}
