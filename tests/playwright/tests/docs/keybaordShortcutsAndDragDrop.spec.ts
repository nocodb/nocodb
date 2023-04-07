import { Page, test } from '@playwright/test';
import { ProjectType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Tiptap:Keyboard shortcuts and drag and drop', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let project: ProjectType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, projectType: ProjectTypes.DOCUMENTATION });
    project = context.project;
    dashboard = new DashboardPage(page, context.project);
  });

  test('Tiptap:Drag and drop', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      projectTitle: project.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Heading 1',
      index: 0,
    });
    await openedPage.tiptap.fillContent({
      content: 'Heading 1 content',
      index: 0,
      type: 'Heading 1',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Heading 2',
      index: 1,
    });
    await openedPage.tiptap.fillContent({
      content: 'Heading 2 content',
      index: 1,
      type: 'Heading 2',
    });

    await openedPage.tiptap.dragToNode({
      fromIndex: 0,
      toIndex: 1,
    });

    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 2',
      content: 'Heading 2 content',
    });

    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Heading 1',
      content: 'Heading 1 content',
    });

    await openedPage.tiptap.addNewNode({
      index: 2,
      type: 'Image',
      filePath: `${process.cwd()}/fixtures/sampleFiles/sampleImage.jpeg`,
    });
    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Image',
      isUploading: false,
    });

    await openedPage.tiptap.clickNode({
      index: 2,
      start: false,
    });
    await openedPage.tiptap.dragToNode({
      fromIndex: 2,
      toIndex: 0,
      withoutHandle: true,
    });
    await openedPage.tiptap.verifyNode({
      index: 0,
      type: 'Heading 2',
      content: 'Heading 2 content',
    });
    await openedPage.tiptap.verifyNode({
      index: 1,
      type: 'Image',
      isUploading: false,
    });
    await openedPage.tiptap.verifyNode({
      index: 2,
      type: 'Heading 1',
      content: 'Heading 1 content',
    });
  });
});
