import { test } from '@playwright/test';
import { BaseType, ProjectTypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext } from '../../setup';

test.describe('Docs Link test', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let base: BaseType;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, baseType: ProjectTypes.DOCUMENTATION });
    base = context.base;
    dashboard = new DashboardPage(page, context.base);
  });

  test('Tiptap: Link', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
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

    await openedPage.tiptap.clearContent();

    // TODO: Fix this test. Failing in headless mode
    // await openedPage.copyToClipboard({ text: link });
    // await page.waitForTimeout(350);
    // await openedPage.tiptap.clickNode({
    //   index: 0,
    //   start: false,
    // });
    // await page.keyboard.press('Meta+v', {
    //   delay: 100,
    // });

    // await openedPage.tiptap.verifyLinkOptionVisible({
    //   visible: true,
    // });

    // await openedPage.tiptap.verifyLinkNode({
    //   index: 0,
    //   url: link,
    //   placeholder: link,
    // });
  });

  test('Tiptap: Internal Links', async ({ page }) => {
    const openedPage = await dashboard.docs.openedPage;
    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.clickSharePage();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.verifySharePageToggle({ isPublic: true });
    const mainPagePublicLink = await dashboard.shareProjectButton.getPublicPageLink();
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page 1',
    });

    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page 2',
    });

    await dashboard.shareProjectButton.open();
    await dashboard.shareProjectButton.toggleSharePage();
    await dashboard.shareProjectButton.verifySharePageToggle({ isPublic: true });
    await dashboard.shareProjectButton.close();

    await dashboard.sidebar.docsSidebar.createPage({
      baseTitle: base.title as any,
      title: 'page 3',
    });

    await dashboard.sidebar.docsSidebar.openPage({
      baseTitle: base.title as any,
      title: 'page',
    });

    await openedPage.tiptap.addNewNode({
      type: 'Link',
    });

    await page.waitForTimeout(350);
    await page.keyboard.type('page ');

    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 1',
    });

    await page.keyboard.press('ArrowDown');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 2',
    });

    await page.keyboard.press('ArrowDown');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 3',
    });

    await page.keyboard.press('ArrowDown');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 3',
    });

    await page.keyboard.press('ArrowUp');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 2',
    });

    await page.keyboard.press('ArrowUp');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 1',
    });

    await page.keyboard.press('ArrowUp');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 1', 'page 2', 'page 3'],
      selectedTitle: 'page 1',
    });

    await page.keyboard.type('2');
    await openedPage.tiptap.verifyLinkOptionSearchResults({
      titles: ['page 2'],
      selectedTitle: 'page 2',
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    await openedPage.tiptap.verifyLinkNode({
      index: 0,
      placeholder: 'page 2',
    });

    await openedPage.fillTitle({ title: 'main' });

    await openedPage.tiptap.gotoStoredLink({
      index: 0,
    });

    await openedPage.verifyTitle({
      title: 'page 2',
    });

    await page.goto(mainPagePublicLink);

    await openedPage.waitForRender();
    await openedPage.tiptap.gotoStoredLink({
      index: 0,
    });

    await openedPage.verifyTitle({
      title: 'page 2',
    });

    await openedPage.dashboard.shareProjectButton.verifyVisibility({ isVisible: false });
    await openedPage.verifyTitleIsReadOnly({
      editable: false,
    });
  });
});
