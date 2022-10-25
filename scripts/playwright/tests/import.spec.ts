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
    await quickVerify({ dashboard, airtableImport: true, context });
  });

  test("CSV", async () => {
    await dashboard.treeView.quickImport({ title: "CSV file" });
  });

  test("Excel", async () => {
    const col = [
      { type: "Number", name: "number" },
      { type: "Decimal", name: "float" },
      { type: "SingleLineText", name: "text" },
    ];
    const expected = [
      { name: "Sheet2", columns: col },
      { name: "Sheet3", columns: col },
      { name: "Sheet4", columns: col },
    ];

    await dashboard.treeView.quickImport({ title: "Microsoft Excel" });
    await dashboard.importTemplate.import({
      file: `${process.cwd()}/fixtures/sampleFiles/simple.xlsx`,
      result: expected,
    });

    let recordCells = { Number: "1", Float: "1.10", Text: "abc" };

    for (let [key, value] of Object.entries(recordCells)) {
      await dashboard.grid.cell.verify({
        index: 0,
        columnHeader: key,
        value,
      });
    }
  });

  test("JSON", async () => {
    await dashboard.treeView.quickImport({ title: "JSON file" });
  });
});
