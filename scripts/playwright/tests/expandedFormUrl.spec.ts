import { expect, test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

test.describe("Expanded form URL", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("Grid", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.viewSidebar.createGridView({ title: "CountryGrid" });

    // expand row & verify URL
    await dashboard.grid.openExpandedRow({ index: 0 });
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
    await dashboard.grid.verifyRowCount({ count: 25 });

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
  });

  test.skip("Gallery", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });
    await dashboard.treeView.openTable({ title: "Country" });

    await dashboard.viewSidebar.createGalleryView({ title: "CountryGallery" });
    await dashboard.grid.toolbar.fields.toggle({ title: "City List" });

    // expand row & verify URL
  });
});
