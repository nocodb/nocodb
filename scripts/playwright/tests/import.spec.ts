import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import { quickVerify } from "../quickTests/commonTest";
import setup from "../setup";

const apiKey = process.env.E2E_AIRTABLE_API_KEY;
const apiBase = process.env.E2E_AIRTABLE_BASE_ID;

test.describe("Import", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(50000);
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
  });

  test("Airtable", async () => {
    await dashboard.treeView.quickImport({ title: "Airtable" });
    await dashboard.importAirtable.import({
      key: apiKey!,
      baseId: apiBase!,
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await quickVerify({dashboard, airtableImport: true, context});
  });

  test("Excel", async () => {
    await dashboard.treeView.quickImport({ title: "Microsoft Excel" });
  });

  test("CSV", async () => {
    await dashboard.treeView.quickImport({ title: "CSV file" });
  });

  test("JSON", async () => {
    await dashboard.treeView.quickImport({ title: "JSON file" });
  });
});
