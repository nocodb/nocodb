import { expect, test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import { SharedFormPage } from "../pages/SharedForm";
import setup from "../setup";

test.describe("Attachment column", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test.only("Create and verify atttachent column, verify it in shared form,", async ({page, context}) => {
    await dashboard.treeView.openTable({title: "Country"});
    await dashboard.grid.column.create({
      title: "testAttach",
      type: "Attachment",
    })
    for (let i = 4; i <= 6; i++) {
      const filepath = `${process.cwd()}/fixtures/sampleFiles/${i}.json`;
      await dashboard.grid.cell.attachment.addFile({index: i, columnHeader: "testAttach", filePath: filepath});
      await dashboard.grid.cell.attachment.verifyFile({index: i, columnHeader: "testAttach"});
    }

    await dashboard.viewSidebar.createFormView({
      title: "Form 1",
    });
    await dashboard.form.toolbar.clickShareView();
    const sharedFormUrl = await dashboard.form.toolbar.shareView.getShareLink();
    await dashboard.form.toolbar.shareView.close();
    await dashboard.viewSidebar.openView({title: "Country"});

    const newPage  = await context.newPage()
    await newPage.goto(sharedFormUrl);
    const sharedForm = new SharedFormPage(newPage);
    await sharedForm.cell.fillText({index: 0, columnHeader: "Country", text: "test"});
    await sharedForm.cell.attachment.addFile({columnHeader: 'testAttach', filePath: `${process.cwd()}/fixtures/sampleFiles/1.json`});
    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
    await newPage.close();

    await dashboard.grid.toolbar.clickFields()
    await dashboard.grid.toolbar.fields.click({title: "LastUpdate"});
    await dashboard.grid.toolbar.clickActions();
    await dashboard.grid.toolbar.actions.click('Download');

    const csvFileData: string = await dashboard.downloadAndGetFile({
      downloadUIAction: dashboard.grid.toolbar.actions.clickDownloadSubmenu('Download as CSV')
    });
    const csvArray = csvFileData.split('\r\n');
    const columns = csvArray[0];
    const rows = csvArray.slice(1);
    const cells = rows[4].split(',');

    expect(columns).toBe('Country,City List,testAttach');
    expect(cells[0]).toBe('Anguilla');
    expect(cells[1]).toBe('South Hill');
    expect(cells[2].includes('4.json(http://localhost:8080/download/')).toBe(true);
  });
});
