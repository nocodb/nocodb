import { expect, test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import { GalleryPage } from "../pages/Dashboard/Gallery";
import { GridPage } from "../pages/Dashboard/Grid";
import setup from "../setup";

test.describe("Expanded form URL", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  async function viewTest(viewType: string) {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    let viewObj: GridPage | GalleryPage = dashboard.grid;
    if (viewType === "grid") {
      viewObj = dashboard.grid;
    } else if (viewType === "gallery") {
      viewObj = dashboard.gallery;
    }

    if (viewType === "grid") {
      await dashboard.viewSidebar.createGridView({ title: "CountryExpand" });
    } else if (viewType === "gallery") {
      await dashboard.viewSidebar.createGalleryView({
        title: "CountryExpand",
      });
      await viewObj.toolbar.clickFields();
      await viewObj.toolbar.fields.click({ title: "City List" });
    }

    // expand row & verify URL
    await viewObj.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verify({
      header: "Afghanistan",
      url: "rowId=1",
    });

    // // verify copied URL in clipboard
    // await dashboard.expandedForm.copyUrlButton.click();
    // const expandedFormUrl = await dashboard.expandedForm.getClipboardText();
    // expect(expandedFormUrl).toContain("rowId=1");

    // access a new rowID using URL
    let url = await dashboard.rootPage.url();
    await dashboard.expandedForm.close();
    await dashboard.rootPage.goto(
      "/" + url.split("/").slice(3).join("/").split("?")[0] + "?rowId=2"
    );
    await dashboard.expandedForm.verify({
      header: "Algeria",
      url: "rowId=2",
    });
    await dashboard.expandedForm.close();

    // visit invalid rowID
    await dashboard.rootPage.goto(
      "/" + url.split("/").slice(3).join("/").split("?")[0] + "?rowId=999"
    );
    await dashboard.toastWait({ message: "Record not found" });
    // ensure grid is displayed after invalid URL access
    await viewObj.verifyRowCount({ count: 25 });

    // Nested URL
    await dashboard.rootPage.goto(
      "/" + url.split("/").slice(3).join("/").split("?")[0] + "?rowId=1"
    );
    await dashboard.expandedForm.verify({
      header: "Afghanistan",
      url: "rowId=1",
    });
    await dashboard.expandedForm.openChildCard({
      column: "City List",
      title: "Kabul",
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.expandedForm.verify({
      header: "Kabul",
      url: "rowId=1",
    });
    let expandFormCount = await dashboard.expandedForm.count();
    expect(expandFormCount).toBe(2);

    // close child card
    await dashboard.expandedForm.cancel();
    await dashboard.expandedForm.verify({
      header: "Afghanistan",
      url: "rowId=1",
    });
    await dashboard.expandedForm.cancel();
  }

  test("Grid", async () => {
    await viewTest("grid");
  });

  test("Gallery", async () => {
    await viewTest("gallery");
  });
});
