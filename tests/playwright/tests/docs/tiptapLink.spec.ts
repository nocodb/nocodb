import { test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs Link test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Tiptap: Link', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'page',
    });

    await openedPage.tiptap.fillContent({
      content: 'page content',
      index: 0,
    });

    await openedPage.tiptap.addNewNode({
      type: 'Link',
    });

    const link = 'https://www.google.com';
    const linkPlaceholder = 'link text';

    await page.waitForTimeout(350);
    await page.keyboard.type(link);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);

    await page.keyboard.type(linkPlaceholder);

    await openedPage.tiptap.verifyLinkOptionVisible({
      visible: true,
    });

    await openedPage.tiptap.verifyLinkNode({
      index: 1,
      url: link,
      placeholder: linkPlaceholder,
    });

    await page.keyboard.press('Space');
    await page.waitForTimeout(550);
    await page.keyboard.press('Space');
    await page.keyboard.type('nl');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');

    await openedPage.tiptap.verifyLinkNode({
      index: 1,
      url: link,
      placeholder: linkPlaceholder,
    });

    await openedPage.tiptap.clickLinkDeleteButton();
    await openedPage.tiptap.verifyLinkOptionVisible({
      visible: false,
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Paragraph',
      content: 'link text nl',
    });
  });
});
