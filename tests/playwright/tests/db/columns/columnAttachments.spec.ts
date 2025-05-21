import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { SharedFormPage } from '../../../pages/SharedForm';
import setup, { unsetup } from '../../../setup';

test.describe('Attachment column', () => {
  let dashboard: DashboardPage, context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create and verify attachment column, verify it in shared form,', async ({ context }) => {
    // run tests slowly
    test.slow();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.column.create({
      title: 'testAttach',
      type: 'Attachment',
    });

    for (let i = 12; i >= 8; i -= 2) {
      const filepath = [`${__dirname}/../../../fixtures/sampleFiles/${i / 2}.json`];
      await dashboard.grid.cell.attachment.addFile({
        index: i,
        columnHeader: 'testAttach',
        filePath: filepath,
      });

      await dashboard.rootPage.waitForTimeout(500);

      await dashboard.grid.cell.attachment.verifyFile({
        index: i,
        columnHeader: 'testAttach',
      });
    }
    await dashboard.grid.cell.attachment.addFile({
      index: 4,
      columnHeader: 'testAttach',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/sampleImage.jpeg`],
    });

    await dashboard.rootPage.waitForTimeout(1000);

    await dashboard.grid.cell.attachment.verifyFile({
      index: 4,
      columnHeader: 'testAttach',
    });

    // Kludge: tooltip somehow persists. fix me!
    await dashboard.rootPage.reload();

    await dashboard.viewSidebar.createFormView({
      title: 'Form 1',
    });
    await dashboard.rootPage.waitForTimeout(500);
    const sharedFormUrl = await dashboard.form.topbar.getSharedViewUrl();
    await dashboard.treeView.openTable({ title: 'Country' });

    // Verify attachment in shared form
    const newPage = await context.newPage();
    await newPage.goto(sharedFormUrl);
    const sharedForm = new SharedFormPage(newPage);

    await sharedForm.rootPage.waitForTimeout(500);
    await sharedForm.cell.fillText({
      index: 0,
      columnHeader: 'Country',
      text: 'test',
    });

    await sharedForm.rootPage.waitForTimeout(500);
    await sharedForm.cell.attachment.addFile({
      columnHeader: 'testAttach',
      filePath: [`${__dirname}/../../../fixtures/sampleFiles/1.json`],
      skipElemClick: true,
    });

    await sharedForm.rootPage.waitForTimeout(1000);
    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
    await newPage.close();

    // Verify attachment in csv
    await dashboard.grid.toolbar.clickFields();
    await dashboard.grid.toolbar.fields.click({ title: 'LastUpdate' });
    await dashboard.grid.toolbar.clickActions();

    // Headless mode observation- menu doesn't render in one go
    // Download button appears before menu is fully rendered
    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.grid.toolbar.actions.click('Download');

    const csvFileData: string = await dashboard.downloadAndGetFile({
      downloadUIAction: dashboard.grid.toolbar.actions.clickDownloadSubmenu('CSV'),
    });
    const csvArray = csvFileData.split('\r\n');
    const columns = csvArray[0];
    const rows = csvArray.slice(1);
    const cells = rows[10].split(',');

    expect(columns).toBe('Country,Cities,testAttach');
    expect(cells[0]).toBe('Bahrain');
    // PR8504
    // await expect(cells[1]).toBe('al-Manama');
    expect(cells[1]).toBe('1');
    expect(cells[2].includes('5.json(http://localhost:8080/dltemp/')).toBe(true);
  });
});
