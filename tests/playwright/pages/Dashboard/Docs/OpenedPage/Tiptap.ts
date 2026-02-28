import { expect, Locator } from '@playwright/test';
import { DocsOpenedPagePage } from '.';
import BasePage from '../../../Base';

export class TiptapPage extends BasePage {
  readonly openedPage: DocsOpenedPagePage;

  constructor(openedPage: DocsOpenedPagePage) {
    super(openedPage.rootPage);
    this.openedPage = openedPage;
  }

  /**
   * Get the ProseMirror editor container.
   * data-testid="docs-page-content" is on the .nc-doc-editor-body wrapper.
   */
  get() {
    return this.openedPage.get().getByTestId('docs-page-content').locator('.ProseMirror');
  }

  /**
   * Get a specific content node by index.
   * In a standard tiptap editor, content nodes are direct children of .ProseMirror.
   */
  getNodeByIndex(index: number) {
    return this.get().locator(`> *:nth-child(${index + 1})`);
  }

  private async _click(locator: Locator) {
    const el = await locator.elementHandle();
    if (!el) throw new Error('Element not found for click');
    await el.waitForElementState('stable');

    const box = await el.boundingBox();
    if (!box) throw new Error('Element has no bounding box');
    return this.rootPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  private async _hover(locator: Locator) {
    const el = await locator.elementHandle();
    if (!el) throw new Error('Element not found for hover');

    const box = await el.boundingBox();
    if (!box) throw new Error('Element has no bounding box');
    await this.rootPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }

  /**
   * Open the slash command menu by typing "/" in the editor.
   * Clicks the last paragraph if no index specified.
   */
  async openCommandMenu({ index }: { index?: number } = {}) {
    // Ensure editor is editable before interacting
    await expect(this.get()).toHaveAttribute('contenteditable', 'true');

    let paragraph: Locator;
    if (index !== undefined) {
      paragraph = this.getNodeByIndex(index);
    } else {
      paragraph = this.get().locator('> p:last-of-type');
      // If there are no paragraphs, click the editor body to focus it
      if (!(await paragraph.isVisible().catch(() => false))) {
        paragraph = this.get();
      }
    }
    await this._click(paragraph);

    await this.rootPage.waitForTimeout(400);

    await this.rootPage.keyboard.type('/');

    await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'visible' });
  }

  /**
   * Add a new content node via the slash command menu.
   * The command item testid is `nc-docs-command-list-item-${title}`.
   */
  async addNewNode({
    type,
    index,
    link,
    noVerify,
  }: {
    type: TipTapNodes;
    index?: number;
    link?: string;
    noVerify?: boolean;
  }) {
    await this.openCommandMenu({ index });

    const commandTitle = tiptapNodeToSlashCommandTitle[type] || type;

    await this.rootPage.getByTestId(`nc-docs-command-list-item-${commandTitle}`).click();

    // For embed items that require URL input
    if (link) {
      await this.rootPage.getByTestId('nc-docs-command-list-link-input').fill(link);
      await this.rootPage.getByTestId('nc-docs-command-list-link-input').press('Enter');
    }

    if (!noVerify) {
      await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'hidden' });
      // Brief wait for the editor to process the command and update the DOM
      await this.rootPage.waitForTimeout(200);
    }
  }

  /**
   * Verify the slash command menu is visible or hidden.
   */
  async verifyCommandMenuOpened({ isVisible }: { isVisible: boolean }) {
    if (isVisible) {
      await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'visible' });
    } else {
      await this.rootPage.locator('.nc-docs-command-list').waitFor({ state: 'hidden' });
    }
  }

  /**
   * Fill content in the editor by clicking a node and typing.
   */
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
    await this.rootPage.waitForTimeout(500);

    const waitNetwork = waitForNetwork
      ? this.rootPage.waitForResponse(async response => {
          return response.url().includes('operation=documentUpdate') && response.request().method() === 'POST';
        })
      : Promise.resolve();

    await this.get().click({ force: true });

    // Click on the specific node to position cursor
    const domSelector = tiptapNodeToDomType[type] || 'p';
    const node = this.getNodeByIndex(index);
    const targetElement = node.locator(domSelector).first();

    // If the node IS the DOM type (e.g., a <p> is a direct child of ProseMirror)
    if (await targetElement.isVisible().catch(() => false)) {
      await targetElement.click({ force: true });
    } else {
      await node.click({ force: true });
    }

    for (const char of content) {
      await this.rootPage.keyboard.type(char);
    }

    await waitNetwork;
  }

  /**
   * Verify the text content of the entire editor.
   */
  async verifyContent({ content }: { content: string }) {
    await expect(this.get()).toHaveText(content);
  }

  /**
   * Verify that a specific node exists at the given index.
   */
  async verifyNode({ index, type, content }: { index: number; type?: TipTapNodes; content?: string }) {
    type = type || 'Paragraph';
    const node = this.getNodeByIndex(index);

    if (type === 'Embed iframe') {
      await expect(node.locator('.nc-embed-iframe-wrapper').locator('iframe')).toHaveAttribute('src', content);
      return;
    }

    await expect(node).toBeVisible();

    if (content) {
      await expect(node).toContainText(content);
    }
  }

  /**
   * Verify a heading node at a given index.
   */
  async verifyHeaderNode({ index, type, content }: { index: number; type: TipTapNodes; content?: string }) {
    const level = type.split(' ')[1];
    const node = this.getNodeByIndex(index);

    await expect(node).toBeVisible();

    if (content) {
      await expect(node.locator(`h${level}`).first()).toHaveText(content);
    }
  }

  /**
   * Fill a table cell at a specific row/column position.
   */
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
    const node = this.getNodeByIndex(index);
    const cell = node
      .locator(`tr:nth-child(${row + 1})`)
      .locator(`td:nth-child(${column + 1}), th:nth-child(${column + 1})`)
      .first();

    await cell.click({ force: true });
    await this.rootPage.keyboard.type(content);
  }

  /**
   * Verify table node structure and cell contents.
   */
  async verifyTableNode({
    index,
    cells,
    rowCount,
    columnCount,
  }: {
    index: number;
    cells?: {
      row: number;
      column: number;
      content: string;
    }[];
    rowCount?: number;
    columnCount?: number;
  }) {
    const node = this.getNodeByIndex(index);
    await expect(node.locator('table')).toBeVisible();

    if (cells) {
      for (const cell of cells) {
        await expect(
          node
            .locator(`tr:nth-child(${cell.row + 1})`)
            .locator(`td:nth-child(${cell.column + 1}), th:nth-child(${cell.column + 1})`)
            .first()
        ).toContainText(cell.content);
      }
    }

    if (rowCount) {
      await expect(node.locator('tr')).toHaveCount(rowCount);
    }

    if (columnCount) {
      await expect(node.locator('tr:first-child').locator('td, th')).toHaveCount(columnCount);
    }
  }

  /**
   * Verify a list node (bullet, numbered, or task).
   */
  async verifyListNode({
    index,
    type,
    content,
    checked,
  }: {
    index: number;
    type: TipTapNodes;
    content: string;
    checked?: boolean;
  }) {
    const node = this.getNodeByIndex(index);
    await expect(node).toContainText(content);

    if (checked !== undefined && type === 'Task List') {
      await expect(node.locator('input[type="checkbox"]').first()).toBeChecked({ checked });
    }
  }

  /**
   * Toggle a task list checkbox.
   */
  async toggleTaskNode({ index }: { index: number }) {
    const node = this.getNodeByIndex(index);
    await node.locator('input[type="checkbox"]').first().click({ force: true });
  }

  /**
   * Verify text formatting (bold, italic, etc.) on a node.
   */
  async verifyTextFormatting({
    index,
    text,
    formatType,
  }: {
    index: number;
    text: string;
    formatType: 'bold' | 'italic' | 'strike' | 'underline' | 'code';
  }) {
    const node = this.getNodeByIndex(index);
    await expect(node.locator(tiptapTextFormatToDomType[formatType])).toHaveText(text);
  }

  /**
   * Clear all editor content.
   */
  async clearContent() {
    await this.openedPage.waitForRender();
    await this.get().click();
    await this.rootPage.waitForTimeout(300);
    await this.rootPage.keyboard.press('ControlOrMeta+A');
    await this.rootPage.keyboard.press('Backspace');
    await this.rootPage.waitForTimeout(300);
  }
}

export type TipTapNodes =
  | 'Heading 1'
  | 'Heading 2'
  | 'Heading 3'
  | 'Paragraph'
  | 'Blockquote'
  | 'Code Block'
  | 'Bullet List'
  | 'Numbered List'
  | 'Task List'
  | 'Divider'
  | 'Image'
  | 'Table'
  | 'Note'
  | 'Warning'
  | 'Tip'
  | 'Important'
  | 'Embed iframe';

export type TextFormatType = 'bold' | 'italic' | 'underline' | 'strike';

/**
 * Maps TipTapNodes to the slash command menu item titles.
 * These match the `title` field in SlashCommand.ts.
 */
const tiptapNodeToSlashCommandTitle: Partial<Record<TipTapNodes, string>> = {
  'Heading 1': 'Heading 1',
  'Heading 2': 'Heading 2',
  'Heading 3': 'Heading 3',
  'Bullet List': 'Bullet List',
  'Numbered List': 'Numbered List',
  'Task List': 'Task List',
  Blockquote: 'Blockquote',
  'Code Block': 'Code Block',
  Table: 'Table',
  Image: 'Image',
  Divider: 'Divider',
  Note: 'Note',
  Warning: 'Warning',
  Tip: 'Tip',
  Important: 'Important',
};

/**
 * Maps node types to DOM selectors for verifying node types in the editor.
 */
const tiptapNodeToDomType: Partial<Record<TipTapNodes, string>> = {
  'Heading 1': 'h1',
  'Heading 2': 'h2',
  'Heading 3': 'h3',
  Paragraph: 'p',
  Blockquote: 'blockquote',
  'Code Block': 'pre',
  'Bullet List': 'ul',
  'Numbered List': 'ol',
  'Task List': 'ul[data-type="taskList"]',
  Divider: 'hr',
  Table: 'table',
  Note: '.nc-callout-note',
  Warning: '.nc-callout-warning',
  Tip: '.nc-callout-tip',
  Important: '.nc-callout-important',
};

const tiptapTextFormatToDomType: Record<'bold' | 'italic' | 'underline' | 'strike' | 'code', string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
};
