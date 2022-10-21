import { test } from "@playwright/test";
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

  test("Create duration column", async ({page, context}) => {
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
    const newPage  = await context.newPage()
    await newPage.goto(sharedFormUrl);

    const sharedForm = new SharedFormPage(newPage);
    await sharedForm.cell.attachment.addFile({columnHeader: 'testAttach', filePath: `${process.cwd()}/fixtures/sampleFiles/1.json`});
    await sharedForm.submit();
  });
});
