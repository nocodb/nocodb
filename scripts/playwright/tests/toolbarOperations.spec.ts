import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";
import { ToolbarPage } from "../pages/Dashboard/Toolbar";

test.describe("Toolbar operations (GRID)", () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage;
  let context: any;

  async function validateFirstRow(value: string) {
    await dashboard.grid.cell.verify({
      index: 0,
      columnHeader: "Country",
      value: value,
    });
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.toolbar;
  });

  test("Hide, Sort, Filter", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });

    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.grid.column.verify({
      title: "LastUpdate",
      isVisible: true,
    });

    // hide column
    console.log("hide column");
    await toolbar.fields.toggle({ title: "LastUpdate" });
    await dashboard.grid.column.verify({
      title: "LastUpdate",
      isVisible: false,
    });

    // un-hide column
    console.log("un-hide column");
    await toolbar.fields.toggle({ title: "LastUpdate" });
    await dashboard.grid.column.verify({
      title: "LastUpdate",
      isVisible: true,
    });

    await validateFirstRow("Afghanistan");
    // Sort column
    console.log("sort column");
    await toolbar.sort.addSort({ columnTitle: "Country", isAscending: false });
    await validateFirstRow("Zambia");

    // reset sort
    console.log("reset sort");
    await toolbar.sort.resetSort();
    await validateFirstRow("Afghanistan");

    // Filter column
    console.log("filter column");
    await toolbar.filter.addNew({
      columnTitle: "Country",
      value: "India",
      opType: "is equal",
    });
    await validateFirstRow("India");

    // Reset filter
    console.log("reset filter");
    await toolbar.filter.resetFilter();
    await validateFirstRow("Afghanistan");

    await dashboard.closeTab({ title: "Country" });
  });
});
