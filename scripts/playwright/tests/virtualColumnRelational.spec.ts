import { test } from "@playwright/test";
import { expect } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import { SettingsPage } from "../pages/Dashboard/Settings";
import setup from "../setup";

test.describe.only("Relational Columns", () => {
  let dashboard: DashboardPage, settings: SettingsPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    settings = new SettingsPage(page);
  });

  test("Belongs To", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    const cell = await dashboard.grid.cell.get({
      index: 0,
      columnHeader: "City List",
    });

    // expect(await cell.locator(".chip").count()).toBe(3);
    // expect(await cell.locator(".chip").nth(0)).toHaveText("Kabul");

    await dashboard.grid.cell.verify({
      index: 0,
      columnHeader: "City List",
      value: "Kabul",
    });
  });
});
