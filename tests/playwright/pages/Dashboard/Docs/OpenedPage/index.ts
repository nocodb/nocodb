import { expect } from '@playwright/test';
import { DashboardPage } from '../..';
import BasePage from '../../../Base';
import { TiptapPage } from './Tiptap';

export type TipTapNodes =
  | 'Heading 1'
  | 'Heading 2'
  | 'Heading 3'
  | 'Paragraph'
  | 'Quote'
  | 'Code Block'
  | 'Bulleted List'
  | 'Numbered List'
  | 'Todo List'
  | 'Horizontal Rule'
  | 'Image'
  | 'Table'
  | 'Link'
  | 'Emoji'
  | 'Info notice'
  | 'Warning notice'
  | 'Tip notice';

export class DocsOpenedPagePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly tiptap: TiptapPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.tiptap = new TiptapPage(this);
  }

  get() {
    return this.dashboard.get().getByTestId('docs-opened-page');
  }

  async waitForRender() {
    await this.get().waitFor({ state: 'visible' });
    await this.get().getByTestId('docs-page-title').waitFor({ state: 'visible' });
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

    await this.get().getByTestId('docs-page-title').press('Meta+A');
    await this.get().getByTestId('docs-page-title').press('Backspace');

    await this.waitForResponse({
      uiAction: () => this.get().getByTestId('docs-page-title').type(title),
      httpMethodsToMatch: ['PUT'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });
  }

  async verifyTitle({ title }: { title: string }) {
    await expect.poll(() => this.get().getByTestId('docs-page-title').inputValue()).toBe(title);
  }

  async verifyPageOutlineOpened({ isOpened }: { isOpened: boolean }) {
    if (isOpened) {
      await expect(this.rootPage.getByTestId('docs-page-outline-toggle')).toBeVisible();
      await expect(this.rootPage.getByTestId('docs-page-outline-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(this.rootPage.getByTestId('docs-page-outline-content')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('docs-page-outline-toggle')).toBeVisible();
      await expect(this.rootPage.getByTestId('docs-page-outline-toggle')).toHaveAttribute('aria-expanded', 'false');
      await expect(this.rootPage.getByTestId('docs-page-outline-content')).not.toBeVisible();
    }
  }

  async verifyOpenedPageVisible() {
    await expect(this.get()).toBeVisible();
  }

  async selectEmoji({ emoji }: { emoji: string }) {
    await this.get().getByTestId('nc-doc-opened-page-icon-picker').hover();
    await this.get().getByTestId('nc-doc-opened-page-icon-picker').click();

    await this.rootPage.getByTestId('nc-emoji-filter').last().type(emoji);

    await this.rootPage.waitForTimeout(500);

    await this.waitForResponse({
      uiAction: () =>
        this.rootPage.getByTestId('nc-emoji-container').last().locator(`.nc-emoji-item >> svg`).first().click(),
      httpMethodsToMatch: ['PUT'],
      requestUrlPathToMatch: `api/v1/docs/page`,
    });
  }

  async verifyTitleEmoji({ emoji }: { emoji: string }) {
    await expect(
      this.get().getByTestId('docs-page-title-wrapper').getByTestId(`nc-doc-page-icon-emojione:${emoji}`)
    ).toBeVisible();
  }

  async verifyChildPage({ title }: { title: string }) {
    await this.get()
      .locator('.docs-page-child-pages')
      .locator(`.docs-page-child-page >> text=${title}`)
      .scrollIntoViewIfNeeded();

    await expect(
      this.get().locator('.docs-page-child-pages').locator(`.docs-page-child-page >> text=${title}`)
    ).toBeVisible();
  }

  async verifyChildPagesNotVisible() {
    await expect(this.get().locator('.docs-page-child-pages')).not.toBeVisible();
  }

  async verifyTitleIsReadOnly({ editable }: { editable: boolean }) {
    await expect(this.get().getByTestId('docs-page-title')).toBeEditable({
      editable: editable,
    });
  }

  async verifyContentIsReadOnly({ editable }: { editable: boolean }) {
    await expect(this.get().getByTestId('docs-page-content').locator('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      editable ? 'true' : 'false'
    );
  }
}
