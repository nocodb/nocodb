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

    await this.get().getByTestId('docs-page-title').click();

    await this.get().getByTestId('docs-page-title').press('ControlOrMeta+A');
    await this.get().getByTestId('docs-page-title').press('Backspace');

    await this.waitForResponse({
      uiAction: () => this.get().getByTestId('docs-page-title').type(title, { delay: 0 }),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: `operation=documentUpdate`,
    });
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
