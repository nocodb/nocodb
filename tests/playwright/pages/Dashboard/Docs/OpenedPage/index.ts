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
      uiAction: () => this.get().getByTestId('docs-page-title').type(title, { delay: 0 }),
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

  async togglePageOutline() {
    await this.rootPage.getByTestId('docs-page-outline-toggle').click();
  }

  async verifyPageOutline({ pages }: { pages: { title: string; active?: boolean; level?: number }[] }) {
    for (let index = 0; index < pages.length; index++) {
      const { title, active, level } = pages[index];
      await expect(this.rootPage.getByTestId(`docs-page-outline-subheading-${index}`)).toHaveText(title);

      if (active) {
        await expect(this.rootPage.getByTestId(`docs-page-outline-subheading-${index}`)).toHaveAttribute(
          'aria-current',
          'page'
        );
      }

      if (level) {
        await expect(this.rootPage.getByTestId(`docs-page-outline-subheading-${index}`)).toHaveAttribute(
          'aria-level',
          level.toString()
        );
      }
    }
  }

  async verifyBreadcrumb({ pages }: { pages: { title: string; emoji?: string }[] }) {
    for (let index = 0; index < pages.length; index++) {
      const { title, emoji } = pages[index];
      await expect(this.get().getByTestId(`nc-doc-page-breadcrumb-${index}`)).toHaveText(title);

      if (emoji) {
        await expect(
          this.get().getByTestId(`nc-doc-page-breadcrumb-${index}`).getByTestId(`nc-doc-page-icon-emojione:${emoji}`)
        ).toBeVisible();
      }
    }
  }
}
