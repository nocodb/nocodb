import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

test.describe("Grid view locked", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("ReadOnly lock & collaboration mode", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.toolbar.viewsMenu.verifyCollaborativeMode();

    // enable view lock
    await dashboard.toolbar.viewsMenu.click({
      menu: "Collaborative View",
      subMenu: "Locked View",
    });

    // verify view lock
    await dashboard.toolbar.viewsMenu.verifyLockMode();

    // enable collaborative view
    await dashboard.toolbar.viewsMenu.click({
      menu: "Locked View",
      subMenu: "Collaborative View",
    });

    await dashboard.toolbar.viewsMenu.verifyCollaborativeMode();
  });
});
