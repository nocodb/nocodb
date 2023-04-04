import { expect } from '@playwright/test';
import { DocsOpenedPagePage } from '.';
import BasePage from '../../../Base';

export class TiptapPage extends BasePage {
  readonly openedPage: DocsOpenedPagePage;

  constructor(openedPage: DocsOpenedPagePage) {
    super(openedPage.rootPage);
    this.openedPage = openedPage;
  }

  get() {
    return this.openedPage.get().getByTestId('docs-page-content').locator('.ProseMirror');
  }

  async openCommandMenu({ index }: { index?: number } = {}) {
    if (index) {
      const paragraph = this.get()
        .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
        .locator('p:nth-child(1)');
      await paragraph.click();
    } else {
      const paragraph = this.get().locator('.draggable-block-wrapper:last-child').locator('p:nth-child(1)');
      await paragraph.click();
    }
    await this.rootPage.keyboard.press('/');

    await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'visible' });
  }

  async addNewNode({ type, index }: { type: TipTapNodes; index?: number }) {
    await this.openCommandMenu({ index });
    await this.rootPage.getByTestId(`nc-docs-command-list-item-${type}`).click();

    await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'hidden' });
  }

  async fillContent({
    content,
    index = 0,
    waitForNetwork = true,
  }: {
    content: string;
    index?: number;
    waitForNetwork?: boolean;
  }) {
    await this.openedPage.waitForRender();
    await this.rootPage.waitForTimeout(1000);

    const waitNetwork = waitForNetwork
      ? this.rootPage.waitForResponse(async response => {
          return response.url().includes('api/v1/docs/page') && response.request().method() === 'PUT';
        })
      : Promise.resolve();

    await this.get().click();

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator('p:nth-child(1)')
      .click({
        force: true,
      });

    for (const char of content) {
      await this.rootPage.keyboard.type(char);
    }

    await waitNetwork;
  }

  async clickNode({ index, start }: { index: number; start: boolean }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator('p:first-child')
      .click({
        force: true,
        position: start
          ? {
              x: 0,
              y: 0,
            }
          : undefined,
      });
  }

  async verifyNode({
    index,
    type,
    content,
    childParagraphCount,
    childParagraph,
  }: {
    index: number;
    type?: TipTapNodes;
    content?: string;
    childParagraphCount?: number;
    childParagraph?: { index: number; content: string };
  }) {
    const node = this.get().locator(`.draggable-block-wrapper:nth-child(${index + 1})`);

    if (content) {
      await expect(node).toContainText(content);
    }

    if (type) {
      await expect(node.locator('.node-view-drag-content')).toHaveAttribute(
        'data-testid',
        `nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`
      );
    }

    if (childParagraphCount) {
      await expect(node.locator('.node-view-drag-content').locator('p')).toHaveCount(childParagraphCount);
    }

    if (childParagraph) {
      await expect(
        node.locator('.node-view-drag-content').locator(`p:nth-child(${childParagraph.index + 1})`)
      ).toHaveText(childParagraph.content);
    }
  }

  async verifyContent({ content }: { content: string }) {
    await expect(this.get()).toHaveText(content);
  }

  async clearContent() {
    await this.openedPage.waitForRender();
    await this.rootPage.waitForTimeout(1000);

    await this.get().click();
    await this.get()
      .elementHandle()
      .then(async el => {
        await el?.waitForElementState('stable');
      });

    const firstParagraph = this.get().locator('.draggable-block-wrapper:nth-child(1)').locator('p:nth-child(1)');
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
}

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

const tiptapNodeLabels: Record<TipTapNodes, string> = {
  'Info notice': 'infoCallout',
  'Warning notice': 'warningCallout',
  'Tip notice': 'tipCallout',
  Paragraph: 'paragraph',
};
