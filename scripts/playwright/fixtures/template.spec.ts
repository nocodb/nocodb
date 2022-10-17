import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

test.describe("Test block name", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("Test case name", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    // ...
    // ..
  });
});
