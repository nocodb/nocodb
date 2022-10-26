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
    await dashboard.createProject({ name: "project-1", type: "xcdb" });
    await dashboard.clickHome();
    await dashboard.renameProject({
      title: "project-1",
      newTitle: "project-new",
    });
    await dashboard.clickHome();
    await dashboard.openProject({ title: "project-new" });
    await dashboard.clickHome();
    await dashboard.deleteProject({ title: "project-new" });
  });
});
