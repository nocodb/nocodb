import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

test.describe("Relational Columns", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("Relational columns: HM, BT, MM", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });

    const cityList = [["Kabul"], ["Batna", "Bchar", "Skikda"]]
    await dashboard.treeView.openTable({ title: "Country" });
    for(let i = 0; i < cityList.length; i++) {
      await dashboard.grid.cell.verifyVirtualCell({
        index: i,
        columnHeader: "City List",
        value: cityList[i],
      });
    }

    // click on expand icon, open child list
    await dashboard.grid.cell.inCellExpand({
      index: 0,
      columnHeader: "City List",
    });
    await dashboard.childList.verify({
      cardTitle: ["Kabul"],
    });

    // open link record modal
    //
    await dashboard.childList.get().locator(`button:has-text("Link to 'City'")`).click();
    await dashboard.linkRecord.verify([
      "A Corua (La Corua)",
      "Abha",
      "Abu Dhabi",
      "Acua",
      "Adana",
      "Addis Abeba",
      "Aden",
      "Adoni",
      "Ahmadnagar",
      "Akishima",
    ]);
    await dashboard.linkRecord.close();
    await dashboard.closeTab({ title: "Country" });

    await dashboard.treeView.openTable({ title: "City" });
    const countryList = [["Spain"], ["Saudi Arabia"]]
    for(let i = 0; i < countryList.length; i++) {
      await dashboard.grid.cell.verifyVirtualCell({
        index: i,
        columnHeader: "Country",
        value: countryList[i],
      });
    }
    await dashboard.closeTab({ title: "City" });
  });
});
