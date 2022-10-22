import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/common/Toolbar";

test.describe("Project operations", () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
  });

  test("rename, delete", async () => {
    await dashboard.clickHome();
    await dashboard.renameProject({
      title: "externalREST0",
      newTitle: "externalREST0x",
    });
    await dashboard.clickHome();
    await dashboard.openProject({ title: "externalREST0x" });
    await dashboard.clickHome();
    await dashboard.deleteProject({ title: "externalREST0x" });
  });
});
