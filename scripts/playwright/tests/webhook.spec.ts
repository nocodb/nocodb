import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/common/Toolbar";

test.describe.skip("Webhook", () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
  });

  test("CRUD", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.createTable({ title: "Test" });

    await toolbar.clickActions();
    await toolbar.actions.click("Webhooks");

    await dashboard.webhookForm.create({
      title: "Test",
      url: "https://example.com",
      event: "After Insert",
    });

    await dashboard.webhookForm.addCondition();
  });
});
