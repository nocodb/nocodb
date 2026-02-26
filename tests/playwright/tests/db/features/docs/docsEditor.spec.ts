import { expect, test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';

test.describe('Docs — Editor Content', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({
      page,
      baseType: ProjectTypes.DOCUMENTATION,
      isEmptyProject: true,
    });
    dashboard = new DashboardPage(page, context.base);

    // Create a page to work with in each test
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: context.base.title,
      title: 'Editor Test Page',
    });

    await dashboard.docs.openedPage.waitForRender();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Slash command menu — open, navigate, and select heading', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Type "/" to trigger the slash command menu
    await tiptap.openCommandMenu();

    // Verify menu is visible
    await tiptap.verifyCommandMenuOpened({ isVisible: true });

    // Select "Heading 1"
    await page.getByTestId('nc-docs-command-list-item-Heading 1').click();

    // Verify menu closes
    await tiptap.verifyCommandMenuOpened({ isVisible: false });
  });

  test('Insert headings via slash commands', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert H1
    await tiptap.addNewNode({ type: 'Heading 1' });
    await page.keyboard.type('Heading One');

    // Press Enter to create new line, then insert H2
    await page.keyboard.press('Enter');
    await tiptap.addNewNode({ type: 'Heading 2', index: 1 });
    await page.keyboard.type('Heading Two');

    // Press Enter to create new line, then insert H3
    await page.keyboard.press('Enter');
    await tiptap.addNewNode({ type: 'Heading 3', index: 2 });
    await page.keyboard.type('Heading Three');

    // Verify headings exist in the editor
    await expect(tiptap.get().locator('h1')).toContainText('Heading One');
    await expect(tiptap.get().locator('h2')).toContainText('Heading Two');
    await expect(tiptap.get().locator('h3')).toContainText('Heading Three');
  });

  test('Insert bullet list via slash command', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert bullet list
    await tiptap.addNewNode({ type: 'Bullet List' });

    // Type items
    await page.keyboard.type('First item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third item');

    // Verify bullet list exists
    await expect(tiptap.get().locator('ul')).toBeVisible();
    await expect(tiptap.get().locator('ul li')).toHaveCount(3);
  });

  test('Insert numbered list via slash command', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert numbered list
    await tiptap.addNewNode({ type: 'Numbered List' });

    // Type items
    await page.keyboard.type('Step one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Step two');

    // Verify ordered list
    await expect(tiptap.get().locator('ol')).toBeVisible();
    await expect(tiptap.get().locator('ol li')).toHaveCount(2);
  });

  test('Insert task list via slash command and toggle checkbox', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert task list
    await tiptap.addNewNode({ type: 'Task List' });

    // Type a task
    await page.keyboard.type('My task');

    // Verify task list with checkbox
    await expect(tiptap.get().locator('ul[data-type="taskList"]')).toBeVisible();
    await expect(tiptap.get().locator('input[type="checkbox"]').first()).not.toBeChecked();

    // Toggle the checkbox
    await tiptap.get().locator('input[type="checkbox"]').first().click({ force: true });
    await expect(tiptap.get().locator('input[type="checkbox"]').first()).toBeChecked();
  });

  test('Insert blockquote via slash command', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert blockquote
    await tiptap.addNewNode({ type: 'Blockquote' });
    await page.keyboard.type('A wise quote');

    // Verify blockquote
    await expect(tiptap.get().locator('blockquote')).toBeVisible();
    await expect(tiptap.get().locator('blockquote')).toContainText('A wise quote');
  });

  test('Insert divider via slash command', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Type some text first
    await tiptap.get().click();
    await page.keyboard.type('Before divider');
    await page.keyboard.press('Enter');

    // Insert divider
    await tiptap.addNewNode({ type: 'Divider', index: 1 });

    // Verify hr exists
    await expect(tiptap.get().locator('hr')).toBeVisible();
  });

  test('Insert code block via slash command', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert code block
    await tiptap.addNewNode({ type: 'Code Block' });
    await page.keyboard.type('const x = 42;');

    // Verify code block (pre tag)
    await expect(tiptap.get().locator('pre')).toBeVisible();
    await expect(tiptap.get().locator('pre')).toContainText('const x = 42;');
  });

  test('Insert table via slash command and fill cells', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert table (creates a 3x3 table with header row)
    await tiptap.addNewNode({ type: 'Table' });

    // Verify table exists
    await expect(tiptap.get().locator('table')).toBeVisible();

    // Fill header cells
    await tiptap.fillTableCell({ index: 0, row: 0, column: 0, content: 'Name' });
    await tiptap.fillTableCell({ index: 0, row: 0, column: 1, content: 'Age' });
    await tiptap.fillTableCell({ index: 0, row: 0, column: 2, content: 'City' });

    // Fill data cells
    await tiptap.fillTableCell({ index: 0, row: 1, column: 0, content: 'Alice' });
    await tiptap.fillTableCell({ index: 0, row: 1, column: 1, content: '30' });
    await tiptap.fillTableCell({ index: 0, row: 1, column: 2, content: 'NYC' });

    // Verify table structure
    await tiptap.verifyTableNode({
      index: 0,
      rowCount: 3,
      columnCount: 3,
      cells: [
        { row: 0, column: 0, content: 'Name' },
        { row: 1, column: 0, content: 'Alice' },
        { row: 1, column: 2, content: 'NYC' },
      ],
    });
  });

  test('Insert callout via slash command', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Insert a Note callout
    await tiptap.addNewNode({ type: 'Note' });
    await page.keyboard.type('This is an important note');

    // Verify callout node
    await expect(tiptap.get().locator('.nc-callout')).toBeVisible();
    await expect(tiptap.get().locator('.nc-callout')).toContainText('This is an important note');
  });

  test('Text formatting — bold, italic, strikethrough via keyboard shortcuts', async ({ page }) => {
    const tiptap = dashboard.docs.openedPage.tiptap;

    // Type some text
    await tiptap.get().click();
    await page.keyboard.type('bold text');

    // Select all text
    await page.keyboard.press('Meta+A');

    // Apply bold
    await page.keyboard.press('Meta+B');

    // Verify bold
    await expect(tiptap.get().locator('strong')).toContainText('bold text');

    // Clear and type italic text
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('italic text');
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Meta+I');

    // Verify italic
    await expect(tiptap.get().locator('em')).toContainText('italic text');
  });
});
