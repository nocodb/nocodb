import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../../pages/Dashboard';
import setup, { unsetup } from '../../../../setup';
import { isEE } from '../../../../setup/db';

// The heading marker rail (gutter minimap TOC) — Linear-style dashes per heading,
// scroll-spy active marker, and a hover outline panel that jumps to headings.
// The rail is only rendered at lg+ widths, so each test uses a wide viewport.
test.describe('Docs — Heading marker rail', () => {
  if (!isEE()) test.skip();
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    context = await setup({
      page,
      isEmptyProject: true,
    });
    dashboard = new DashboardPage(page, context.base);

    await dashboard.sidebar.docsSidebar.createDocument({
      baseTitle: context.base.title,
      title: 'Heading Rail Document',
    });

    await dashboard.docs.openedPage.waitForRender();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // Insert N headings (H1/H2/H3 cycling) so the rail has something to show.
  async function seedHeadings(page: any, count: number) {
    const tiptap = dashboard.docs.openedPage.tiptap;
    const types = ['Heading 1', 'Heading 2', 'Heading 3'] as const;

    for (let i = 0; i < count; i++) {
      if (i > 0) await page.keyboard.press('Enter');
      await tiptap.addNewNode({ type: types[i % 3], index: i });
      await page.keyboard.type(`Section ${i + 1}`);
    }
  }

  test('renders one dash per heading once there are multiple headings', async ({ page }) => {
    const rail = page.getByTestId('nc-doc-toc-rail');

    // No rail with a single heading (nothing to navigate between).
    await dashboard.docs.openedPage.tiptap.addNewNode({ type: 'Heading 1' });
    await page.keyboard.type('Only Section');
    await expect(rail).toHaveCount(0);

    // Add more headings → rail appears with a dash per heading.
    await page.keyboard.press('Enter');
    await dashboard.docs.openedPage.tiptap.addNewNode({ type: 'Heading 2', index: 1 });
    await page.keyboard.type('Second Section');
    await page.keyboard.press('Enter');
    await dashboard.docs.openedPage.tiptap.addNewNode({ type: 'Heading 3', index: 2 });
    await page.keyboard.type('Third Section');

    await expect(rail).toBeVisible();
    await expect(rail.locator('.nc-doc-toc-dash')).toHaveCount(3);
  });

  test('hover opens the outline panel and clicking a row jumps to the heading', async ({ page }) => {
    await seedHeadings(page, 6);

    const rail = page.getByTestId('nc-doc-toc-rail');
    await expect(rail).toBeVisible();

    // Panel is closed until hover.
    const panel = page.getByTestId('nc-doc-toc-panel');
    await expect(panel).toHaveCount(0);

    await rail.hover();
    await expect(panel).toBeVisible();
    await expect(panel.locator('.nc-doc-toc-row')).toHaveCount(6);

    // Click the last row → its heading scrolls into view.
    await panel.getByText('Section 6', { exact: true }).click();
    await expect(page.locator('[data-heading-anchor]').last()).toBeInViewport();
  });

  test('scroll-spy marks the heading in view as active', async ({ page }) => {
    await seedHeadings(page, 8);

    const rail = page.getByTestId('nc-doc-toc-rail');
    await expect(rail).toBeVisible();

    // Open the panel and jump to a later heading, then confirm the active row
    // tracks it (scroll-spy updates `activeId` after the smooth scroll settles).
    await rail.hover();
    const panel = page.getByTestId('nc-doc-toc-panel');
    await panel.getByText('Section 7', { exact: true }).click();

    await rail.hover();
    await expect(page.locator('.nc-doc-toc-row-active')).toContainText('Section 7');
  });
});
