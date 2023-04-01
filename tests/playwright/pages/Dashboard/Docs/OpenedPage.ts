import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class DocsOpenedPagePage extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
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

  async fillContent({ content }: { content: string }) {
    await this.waitForRender();
    await this.rootPage.waitForTimeout(1000);

    await this.get().getByTestId('docs-page-content').click();
    // await this.get()
    //   .getByTestId('docs-page-content')
    //   .locator('.ProseMirror')
    //   .elementHandle()
    //   .then(async el => {
    //     await el?.waitForElementState('stable');
    //   });

    await this.get()
      .getByTestId('docs-page-content')
      .locator('.ProseMirror > .draggable-block-wrapper:nth-child(1)')
      .locator('p:nth-child(1)')
      .click({
        force: true,
      });

    await this.rootPage.waitForTimeout(200);

    for (const char of content) {
      await this.rootPage.keyboard.type(char);
    }

    // await this.waitForResponse({
    //   uiAction: () => this.rootPage.keyboard.insertText(content),
    //   httpMethodsToMatch: ['PUT'],
    //   requestUrlPathToMatch: `api/v1/docs/page`,
    // });

    await this.rootPage.waitForTimeout(750);
  }

  async clearContent() {
    await this.waitForRender();
    await this.rootPage.waitForTimeout(1000);

    await this.get().getByTestId('docs-page-content').click();
    await this.get()
      .getByTestId('docs-page-content')
      .locator('.ProseMirror')
      .elementHandle()
      .then(async el => {
        await el?.waitForElementState('stable');
      });

    const firstParagraph = this.get()
      .getByTestId('docs-page-content')
      .locator('.ProseMirror > .draggable-block-wrapper:nth-child(1)')
      .locator('p:nth-child(1)');
    await firstParagraph.click();
    await this.rootPage.keyboard.press('Meta+A');
    await this.rootPage.keyboard.press('Backspace');

    // TODO: fix this
    await this.rootPage.waitForTimeout(1000);

    // await this.waitForResponse({
    //   uiAction: () => firstParagraph.clear(),
    //   httpMethodsToMatch: ['PUT'],
    //   requestUrlPathToMatch: `api/v1/docs/page`,
    // });
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

  async verifyContent({ content }: { content: string }) {
    await expect(this.get().getByTestId('docs-page-content').locator('.ProseMirror')).toHaveText(content);
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
}
