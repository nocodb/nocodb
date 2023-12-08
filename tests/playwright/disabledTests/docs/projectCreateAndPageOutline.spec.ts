import { test } from '@playwright/test';
import { ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';

test.describe('Create docs base and verify docs UI', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    dashboard = new DashboardPage(page, context.base);
  });

  test('Create docs base and page outline', async ({ page }) => {
    await dashboard.sidebar.createProject({
      title: 'test-docs',
      type: ProjectTypes.DOCUMENTATION,
    });
    await dashboard.docs.pagesList.verifyProjectTitle({ title: 'test-docs' });
    await dashboard.docs.pagesList.verifyOpenedTab({ tab: 'all' });
    await dashboard.shareProjectButton.verifyShareStatus({ visibility: 'private' });

    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: 'test-docs',
      title: 'page',
    });

    const openedPage = dashboard.docs.openedPage;
    await openedPage.verifyTitle({ title: 'page' });

    await openedPage.tiptap.addNewNode({
      type: 'Heading 1',
    });
    await openedPage.tiptap.fillContent({
      type: 'Heading 1',
      content: 'Heading 1',
      index: 0,
    });

    await openedPage.verifyPageOutline({
      pages: [
        {
          title: 'Heading 1',
        },
      ],
    });

    // TODO: Fix this test. Due to headless mode
    return;

    await openedPage.tiptap.clickNode({
      index: 1,
      start: true,
    });
    await page.waitForTimeout(300);
    await page.keyboard.insertText(largePlaceholderText);

    await openedPage.tiptap.addNewNode({
      type: 'Heading 2',
    });
    await openedPage.tiptap.fillContent({
      type: 'Heading 2',
      content: 'Sub Heading 1',
      index: 2,
    });

    await openedPage.tiptap.clickNode({
      index: 3,
      start: true,
    });
    await page.waitForTimeout(300);
    await page.keyboard.insertText(largePlaceholderText);
    await page.waitForTimeout(300);

    await openedPage.tiptap.addNewNode({
      type: 'Heading 1',
    });
    await openedPage.tiptap.fillContent({
      type: 'Heading 1',
      content: 'Heading 2',
      index: 4,
    });

    await openedPage.tiptap.clickNode({
      index: 5,
      start: true,
    });
    await page.waitForTimeout(300);
    await page.keyboard.insertText(largePlaceholderText);
    await page.waitForTimeout(300);

    await openedPage.togglePageOutline();

    await openedPage.tiptap.scrollToNode({
      index: 0,
    });
    await openedPage.verifyPageOutline({
      pages: [
        {
          title: 'Heading 1',
          // active: true,
        },
        {
          title: 'Sub Heading 1',
        },
        {
          title: 'Heading 2',
        },
      ],
    });

    await openedPage.tiptap.scrollToNode({
      index: 3,
    });

    await openedPage.verifyPageOutline({
      pages: [
        {
          title: 'Heading 1',
        },
        {
          title: 'Sub Heading 1',
          // active: true,
        },
        {
          title: 'Heading 2',
        },
      ],
    });

    await openedPage.tiptap.scrollToNode({
      index: 4,
    });

    await openedPage.verifyPageOutline({
      pages: [
        {
          title: 'Heading 1',
        },
        {
          title: 'Sub Heading 1',
        },
        {
          title: 'Heading 2',
          // active: true,
        },
      ],
    });

    await openedPage.tiptap.scrollToNode({
      index: 4,
    });
    await openedPage.tiptap.clickNode({
      index: 4,
      start: true,
    });
    await page.keyboard.type('New ');

    await openedPage.verifyPageOutline({
      pages: [
        {
          title: 'Heading 1',
          level: 1,
        },
        {
          title: 'Sub Heading 1',
          level: 2,
        },
        {
          title: 'New Heading 2',
          level: 1,
          // active: true,
        },
      ],
    });
  });
});

const largePlaceholderText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet, nunc nisl aliquet nisl, eget aliquam nisl nisl sit amet nisl. Sed euismod, nunc ut aliquam aliquet`;
