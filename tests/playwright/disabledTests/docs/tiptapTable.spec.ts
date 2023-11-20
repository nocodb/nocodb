import { Page, test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Table', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap:Table row', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Table',
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Table',
    });

    await openedPage.tiptap.fillTableCell({
      index: 0,
      row: 1,
      column: 0,
      content: 'Cell 1',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 1,
          column: 0,
          content: 'Cell 1',
        },
      ],
      columnCount: 3,
      rowCount: 3,
    });

    await openedPage.tiptap.addTableRow({
      index: 0,
      rowIndex: 1,
      kind: 'above',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 2,
          column: 0,
          content: 'Cell 1',
        },
      ],
    });

    await openedPage.tiptap.fillTableCell({
      index: 0,
      row: 0,
      column: 0,
      content: 'Header 1',
    });

    await openedPage.tiptap.addTableRow({
      index: 0,
      rowIndex: 1,
      kind: 'below',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 0,
          column: 0,
          content: 'Header 1',
        },
        {
          row: 3,
          column: 0,
          content: 'Cell 1',
        },
      ],
    });

    await openedPage.tiptap.fillTableCell({
      index: 0,
      row: 4,
      column: 0,
      content: 'Cell 4',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 4,
          column: 0,
          content: 'Cell 4',
        },
      ],
      rowCount: 5,
    });

    await openedPage.tiptap.addTableRow({
      index: 0,
      kind: 'end',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 4,
          column: 0,
          content: 'Cell 4',
        },
      ],
      rowCount: 6,
    });

    await openedPage.tiptap.deleteTableRow({
      index: 0,
      rowIndex: 5,
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 4,
          column: 0,
          content: 'Cell 4',
        },
      ],
      rowCount: 5,
    });
  });

  test('Tiptap:Table column', async ({ page }) => {
    const openedPage = dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Table',
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Table',
    });

    await openedPage.tiptap.fillTableCell({
      index: 0,
      row: 0,
      column: 0,
      content: 'Header 1',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 0,
          column: 0,
          content: 'Header 1',
        },
      ],
      columnCount: 3,
      rowCount: 3,
    });

    await openedPage.tiptap.addTableColumn({
      index: 0,
      columnIndex: 0,
      kind: 'left',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 0,
          column: 1,
          content: 'Header 1',
        },
      ],
      columnCount: 4,
    });

    await openedPage.tiptap.addTableColumn({
      index: 0,
      columnIndex: 0,
      kind: 'right',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 0,
          column: 2,
          content: 'Header 1',
        },
      ],
      columnCount: 5,
    });

    await openedPage.tiptap.addTableColumn({
      index: 0,
      kind: 'end',
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 0,
          column: 2,
          content: 'Header 1',
        },
      ],
      columnCount: 6,
    });

    await openedPage.tiptap.deleteTableColumn({
      index: 0,
      columnIndex: 1,
    });

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: 0,
          column: 1,
          content: 'Header 1',
        },
      ],
      columnCount: 5,
    });
  });

  test('Tiptap:Table list item header cell', async ({ page }) => {
    await testListItem(page, 0);
  });

  test('Tiptap:Table list item normal cell', async ({ page }) => {
    await testListItem(page, 1);
  });

  async function testListItem(page: Page, rowIndex: number) {
    const openedPage = dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Table',
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Table',
    });

    await openedPage.tiptap.fillTableCell({
      index: 0,
      row: rowIndex,
      column: 0,
      content: '',
    });

    await page.keyboard.type('- Item 1');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.type('Item 2');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    await page.keyboard.type('new');

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: rowIndex,
          column: 0,
          content: 'Item newItem 21',
        },
      ],
      columnCount: 3,
      rowCount: 3,
    });

    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);

    for (const _ of 'Item 21') {
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
    }

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    await openedPage.tiptap.verifyTableNode({
      index: 0,
      cells: [
        {
          row: rowIndex,
          column: 0,
          content: 'Item ne',
        },
      ],
      columnCount: 3,
      rowCount: 3,
    });
  }
});
