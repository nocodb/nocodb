import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

const apiKey = process.env.E2E_AIRTABLE_API_KEY;
const apiBase = process.env.E2E_AIRTABLE_BASE_ID;

test.describe("Import", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("Airtable", async () => {
    // create empty project
    await dashboard.clickHome();
    await dashboard.createProject({ name: "airtable", type: "xcdb" });

    await dashboard.treeView.quickImport({ title: "Airtable" });
    await dashboard.importAirtable.import({
      key: apiKey,
      baseId: apiBase,
    });
    await dashboard.rootPage.waitForTimeout(1000);
  });

  test("Excel", async () => {
    // create empty project
    await dashboard.clickHome();
    await dashboard.createProject({ name: "excel", type: "xcdb" });

    await dashboard.treeView.quickImport({ title: "Microsoft Excel" });
  });

  test("CSV", async () => {
    // create empty project
    await dashboard.clickHome();
    await dashboard.createProject({ name: "CSV", type: "xcdb" });

    await dashboard.treeView.quickImport({ title: "CSV file" });
  });

  test("JSON", async () => {
    // create empty project
    await dashboard.clickHome();
    await dashboard.createProject({ name: "JSON", type: "xcdb" });

    await dashboard.treeView.quickImport({ title: "JSON file" });
  });
});
