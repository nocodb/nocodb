import { test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Page history', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Update page and verify history', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'page',
    });

    await openedPage.fillTitle({
      title: 'Page title',
    });

    await openedPage.tiptap.fillContent({
      content: 'Page content',
    });

    await openedPage.tiptap.fillContent({
      index: 1,
      content: 'Page content 2',
    });

    await page.waitForTimeout(3500);

    await openedPage.history.clickHistoryButton();

    await openedPage.history.verifyHistoryList({
      count: 2,
      items: [
        {
          title: 'Current version',
          index: 0,
          active: true,
        },
        {
          title: 'Edited a few seconds ago',
          index: 1,
        },
      ],
    });

    await openedPage.history.clickHistoryItem({
      index: 1,
    });
    await openedPage.history.verifyHistoryList({
      count: 2,
      items: [
        {
          title: 'Current version',
          index: 0,
        },
        {
          title: 'Edited a few seconds ago',
          index: 1,
          active: true,
        },
      ],
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      content: 'Page content 2',
      history: {
        added: true,
      },
    });
    await openedPage.tiptap.verifyNode({
      index: 2,
      content: '',
      history: {
        added: true,
      },
    });

    await openedPage.history.clickHistoryItem({
      index: 0,
    });
    await openedPage.history.verifyHistoryList({
      count: 2,
      items: [
        {
          title: 'Current version',
          index: 0,
          active: true,
        },
        {
          title: 'Edited a few seconds ago',
          index: 1,
        },
      ],
    });
    await openedPage.history.clickHistoryButton();

    await openedPage.tiptap.clickNode({
      index: 0,
      start: false,
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await openedPage.tiptap.addNewNode({
      index: 1,
      type: 'Image',
      filePath: `${process.cwd()}/fixtures/sampleFiles/sampleImage.jpeg`,
    });
    await page.waitForTimeout(500);
    await openedPage.tiptap.fillContent({
      index: 0,
      content: '0',
    });

    await openedPage.history.clickHistoryButton();
    await openedPage.history.verifyHistoryList({
      items: [
        {
          title: 'Current version',
          index: 0,
          active: true,
        },
        {
          title: 'Edited a few seconds ago',
          index: 1,
        },
        {
          title: 'Edited a few seconds ago',
          index: 2,
        },
      ],
    });

    await openedPage.history.clickHistoryItem({
      index: 1,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      content: 'content',
      type: 'Paragraph',
      history: {
        removed: true,
      },
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      content: 'content0',
      type: 'Paragraph',
      history: {
        added: true,
      },
    });

    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Image',
      history: {
        added: true,
      },
    });

    await openedPage.history.clickHistoryItem({
      index: 3,
    });

    await openedPage.history.clickRestoreButton();
    await openedPage.history.clickRestoreModalConfirmButton();

    await openedPage.tiptap.verifyNode({
      index: 0,
      content: 'Page content',
    });
    await openedPage.tiptap.verifyNode({
      index: 1,
      content: 'Page content 2',
    });
  });
});
