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

  async addNewNode({
    type,
    index,
    link,
    filePath,
    noVerify,
  }: {
    type: TipTapNodes;
    index?: number;
    link?: string;
    filePath?: string;
    noVerify?: boolean;
  }) {
    await this.openCommandMenu({ index });
    if (type === 'Image') {
      await this.attachFile({
        filePath: [filePath],
        filePickUIAction: this.rootPage.getByTestId(`nc-docs-command-list-item-${type}`).click(),
      });

      return;
    }
    await this.rootPage.getByTestId(`nc-docs-command-list-item-${type}`).click();

    if (type === 'Embed iframe') {
      await this.rootPage.getByTestId('nc-docs-command-list-link-input').type(link);
      await this.rootPage.getByTestId('nc-docs-command-list-link-input').press('Enter');
    }

    if (!noVerify) await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'hidden' });
  }

  async verifyErrorCommandMenu({ error }: { error: string }) {
    await expect(this.rootPage.getByTestId('nc-docs-command-list-link-input-error')).toHaveText(error);
  }

  async verifyHeaderNode({ index, type, content }: { index: number; type: TipTapNodes; content?: string }) {
    const level = type.split(' ')[1];

    await expect(
      this.get()
        .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
        .getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`)
        .locator(`h${level}`)
    ).toBeVisible();

    if (content) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`)
          .locator(`h${level}`)
      ).toHaveText(content);
    } else {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`)
          .locator(`h${level}`)
      ).toHaveAttribute('data-placeholder', `Heading ${level}`);
    }
  }

  async clickBackButtonLinkCommandMenu() {
    await this.rootPage.getByTestId('nc-docs-command-list-link-back-btn').click();
  }

  async verifyCommandMenuOpened({ isVisible }: { isVisible: boolean }) {
    if (isVisible) {
      await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'visible' });
    } else {
      await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'hidden' });
    }
  }

  async fillContent({
    content,
    index = 0,
    waitForNetwork = true,
    type = 'Paragraph',
  }: {
    content: string;
    index?: number;
    waitForNetwork?: boolean;
    type?: TipTapNodes;
  }) {
    await this.openedPage.waitForRender();
    await this.rootPage.waitForTimeout(1000);

    let contentDomType;
    switch (type) {
      case 'Paragraph':
        contentDomType = 'p';
        break;
      case 'Heading 1':
        contentDomType = 'h1';
        break;
      case 'Heading 2':
        contentDomType = 'h2';
        break;
      case 'Heading 3':
        contentDomType = 'h3';
        break;
      default:
        contentDomType = 'p';
        break;
    }

    const waitNetwork = waitForNetwork
      ? this.rootPage.waitForResponse(async response => {
          return response.url().includes('api/v1/docs/page') && response.request().method() === 'PUT';
        })
      : Promise.resolve();

    await this.get().click({
      force: true,
    });

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`${type ? tiptapNodeToDomType[type] : 'p'}`)
      .click({
        force: true,
      });

    for (const char of content) {
      await this.rootPage.keyboard.type(char);
    }

    await waitNetwork;
  }

  async scrollToNode({ index }: { index: number }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .scrollIntoViewIfNeeded();
  }

  async clickNode({ index, start }: { index: number; start: boolean }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator('.node-view-drag-content')
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

  async toggleTaskNode({ index }: { index: number }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator('input[type="checkbox"]')
      .click({
        force: true,
      });
  }

  async verifyNode({
    index,
    type,
    content,
    childParagraphCount,
    childParagraph,
    isUploading,
    placeholder,
  }: {
    index: number;
    type?: TipTapNodes;
    content?: string;
    childParagraphCount?: number;
    childParagraph?: { index: number; content: string };
    isUploading?: boolean;
    placeholder?: string;
  }) {
    const node = this.get().locator(`.draggable-block-wrapper:nth-child(${index + 1})`);

    if (type === 'Embed iframe') {
      await expect(node.locator('.external-content-wrapper').locator('iframe')).toHaveAttribute('src', content);
      return;
    }

    if (isUploading) {
      await expect(
        node.getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`).locator(tiptapNodeToDomType[type])
      ).toHaveAttribute('isuploading', 'true');
      await expect(
        node.getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`).locator('.image-uploading-wrapper')
      ).toContainText('Uploading...');
    }

    await expect(
      node.getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`).locator(tiptapNodeToDomType[type])
    ).toBeVisible();

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

    if (placeholder) {
      await expect(
        node.getByTestId(`nc-docs-tiptap-wrapper-${tiptapNodeLabels[type]}`).locator(tiptapNodeToDomType[type])
      ).toHaveAttribute('data-placeholder', placeholder);
    }
  }

  async verifyContent({ content }: { content: string }) {
    await expect(this.get()).toHaveText(content);
  }

  async verifyNodeSelected({ index }: { index: number }) {
    await expect(this.get().locator(`.draggable-block-wrapper:nth-child(${index + 1})`)).toHaveClass(/focused/);
  }

  async verifyListNode({
    index,
    level,
    type,
    content,
    nestedIndex,
    checked,
  }: {
    index: number;
    level: number;
    type: TipTapNodes;
    content: string;
    nestedIndex?: number;
    checked?: boolean;
  }) {
    await this.verifyNode({ index, type, content });

    await expect(
      this.get()
        .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
        .locator(`[data-type="${tiptapNodeLabels[type]}"]`)
    ).toHaveCSS('padding-left', `${level * 16}px`);

    if (nestedIndex) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .locator(`.node-view-drag-content`)
          .locator(`.tiptap-list-item-start > span`)
      ).toHaveAttribute('data-number', `${nestedIndex + 1}`);
    }

    if (checked !== undefined) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .locator(`input[type="checkbox"]`)
      ).toBeChecked({ checked });
    }
  }

  async fillTableCell({
    index,
    row,
    column,
    content,
  }: {
    index: number;
    row: number;
    column: number;
    content: string;
  }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${row + 1})`)
      .locator(`td:nth-child(${column + 1})`)
      .click({
        force: true,
      });

    await this.rootPage.keyboard.type(content);
  }

  async addTableRow({ index, rowIndex, kind }: { index: number; rowIndex?: number; kind: 'above' | 'below' | 'end' }) {
    if (kind === 'end') {
      const addNewRowButton = this.get()
        .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
        .locator(`.tiptap-create-row-btn`);

      await addNewRowButton.hover();
      await addNewRowButton.click();

      return;
    }

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${rowIndex + 1})`)
      .hover();

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${rowIndex + 1})`)
      .getByTestId('nc-docs-table-row-drag-handle-wrapper')
      .click({
        force: true,
      });
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${rowIndex + 1})`)
      .getByTestId(kind === 'above' ? 'nc-docs-table-row-insert-above' : 'nc-docs-table-row-insert-below')
      .click({
        force: true,
      });
  }

  async addTableColumn({
    index,
    columnIndex,
    kind,
  }: {
    index: number;
    columnIndex?: number;
    kind: 'left' | 'right' | 'end';
  }) {
    if (kind === 'end') {
      const addNewColumnButton = this.get()
        .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
        .locator(`.tiptap-create-column-btn`);

      await addNewColumnButton.hover();
      await addNewColumnButton.click();

      return;
    }

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(1)`)
      .locator(`td:nth-child(${columnIndex + 1})`)
      .hover();

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(1)`)
      .locator(`td:nth-child(${columnIndex + 1})`)
      .getByTestId('nc-docs-table-column-drag-handle-wrapper')
      .click({
        force: true,
      });
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(1)`)
      .locator(`td:nth-child(${columnIndex + 1})`)
      .getByTestId(kind === 'left' ? 'nc-docs-table-column-insert-left' : 'nc-docs-table-column-insert-right')
      .click({
        force: true,
      });
  }

  async deleteTableRow({ index, rowIndex }: { index: number; rowIndex?: number }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${rowIndex + 1})`)
      .hover();

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${rowIndex + 1})`)
      .getByTestId('nc-docs-table-row-drag-handle-wrapper')
      .click({
        force: true,
      });
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(${rowIndex + 1})`)
      .getByTestId('nc-docs-table-row-delete')
      .click({
        force: true,
      });
  }

  async deleteTableColumn({ index, columnIndex }: { index: number; columnIndex?: number }) {
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(1)`)
      .locator(`td:nth-child(${columnIndex + 1})`)
      .hover();

    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(1)`)
      .locator(`td:nth-child(${columnIndex + 1})`)
      .getByTestId('nc-docs-table-column-drag-handle-wrapper')
      .click({
        force: true,
      });
    await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`tr:nth-child(1)`)
      .locator(`td:nth-child(${columnIndex + 1})`)
      .getByTestId('nc-docs-table-column-delete')
      .click({
        force: true,
      });
  }

  async verifyTableNode({
    index,
    cells,
    rowCount,
    columnCount,
  }: {
    index: number;
    cells: {
      row: number;
      column: number;
      content: string;
    }[];
    rowCount?: number;
    columnCount?: number;
  }) {
    await this.verifyNode({ index, type: 'Table' });

    for (const cell of cells) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .locator(`.node-view-drag-content`)
          .locator(`tr:nth-child(${cell.row + 1})`)
          .locator(`td:nth-child(${cell.column + 1})`)
      ).toHaveText(cell.content);
    }

    if (rowCount) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .locator(`.node-view-drag-content`)
          .locator(`tr`)
      ).toHaveCount(rowCount);
    }

    if (columnCount) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .locator(`.node-view-drag-content`)
          .locator(`tr:nth-child(1)`)
          .locator(`td`)
      ).toHaveCount(columnCount);
    }
  }

  async verifyLinkNode({ index, placeholder, url }: { index: number; placeholder: string; url?: string }) {
    if (url) {
      await expect(
        this.get()
          .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
          .locator(`.node-view-drag-content`)
          .locator(`a`)
      ).toHaveAttribute('href', url);
    }

    await expect(
      this.get()
        .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
        .locator(`.node-view-drag-content`)
        .locator(`a`)
    ).toHaveText(placeholder);
  }

  async verifyLinkOptionVisible({ visible }: { visible: boolean }) {
    if (visible) {
      await expect(this.rootPage.getByTestId('nc-docs-link-options')).toBeVisible();
    } else {
      await expect(this.rootPage.getByTestId('nc-docs-link-options')).toBeHidden();
    }
  }

  async verifyLinkOptionSearchResults({ titles, selectedTitle }: { titles?: string[]; selectedTitle?: string }) {
    if (titles) {
      for (const title of titles) {
        await expect(this.rootPage.getByTestId(`nc-docs-link-option-searched-page-${title}`)).toContainText(title);
      }

      const count = titles.length;
      await expect(this.rootPage.getByTestId('nc-docs-link-option-searched-pages').locator('.page-item')).toHaveCount(
        count
      );
    }

    if (selectedTitle) {
      await expect(this.rootPage.getByTestId(`nc-docs-link-option-searched-page-${selectedTitle}`)).toHaveClass(
        /selected/
      );
    }
  }

  async gotoStoredLink({ index }: { index: number }) {
    const linkHref = await this.get()
      .locator(`.draggable-block-wrapper:nth-child(${index + 1})`)
      .locator(`.node-view-drag-content`)
      .locator(`a`)
      .getAttribute('href');

    await this.rootPage.goto(linkHref);
    await this.openedPage.waitForRender();
  }

  async clickLinkDeleteButton() {
    await this.rootPage.getByTestId('nc-docs-link-options-open-delete').click();
  }

  async clearContent() {
    await this.openedPage.waitForRender();

    await this.get().click();

    const firstParagraph = this.get()
      .locator('.draggable-block-wrapper:nth-child(1)')
      .locator('.node-view-drag-content');
    await firstParagraph.click();
    await this.rootPage.waitForTimeout(500);
    await this.rootPage.keyboard.press('Meta+A');
    await this.rootPage.keyboard.press('Backspace');

    // TODO: fix this
    await this.rootPage.waitForTimeout(500);

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
  | 'Bullet List'
  | 'Numbered List'
  | 'Task List'
  | 'Divider'
  | 'Image'
  | 'Table'
  | 'Link'
  | 'Emoji'
  | 'Info notice'
  | 'Warning notice'
  | 'Tip notice'
  | 'Embed iframe';

const tiptapNodeLabels: Record<TipTapNodes, string> = {
  'Info notice': 'infoCallout',
  'Warning notice': 'warningCallout',
  'Tip notice': 'tipCallout',
  Paragraph: 'paragraph',
  'Heading 1': 'heading',
  'Heading 2': 'heading',
  'Heading 3': 'heading',
  Divider: 'horizontalRule',
  Image: 'image',
  'Bullet List': 'bullet',
  'Numbered List': 'ordered',
  'Task List': 'task',
  Table: 'table',
};

const tiptapNodeToDomType: Record<TipTapNodes, string> = {
  'Heading 1': 'h1',
  'Heading 2': 'h2',
  'Heading 3': 'h3',
  'Info notice': 'div.info-callout',
  'Warning notice': 'div.warning-callout',
  'Tip notice': 'div.tip-callout',
  Paragraph: 'p',
  Divider: 'hr',
  'Embed iframe': 'iframe',
  Image: 'img',
  'Bullet List': 'div[data-type="bullet"]',
  'Numbered List': 'div[data-type="ordered"]',
  'Task List': 'div[data-type="task"]',
  Table: 'div.tiptap-table-wrapper',
};
