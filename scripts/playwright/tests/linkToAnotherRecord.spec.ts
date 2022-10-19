import { test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import setup from "../setup";

test.describe("LTAR create & update", () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test("LTAR", async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: "Team & Auth" });

    await dashboard.treeView.createTable({ title: "Sheet1" });
    // subsequent table creation fails; hence delay
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: "Sheet2" });

    await dashboard.treeView.openTable({ title: "Sheet1" });
    await dashboard.grid.addNewRow({ index: 0, value: "1a" });
    await dashboard.grid.addNewRow({ index: 1, value: "1b" });
    await dashboard.grid.addNewRow({ index: 2, value: "1c" });

    // Create LTAR-HM column
    await dashboard.grid.column.create({
      title: "Link1-2hm",
      type: "LinkToAnotherRecord",
      childTable: "Sheet2",
      relationType: "Has Many",
    });
    await dashboard.grid.column.create({
      title: "Link1-2mm",
      type: "LinkToAnotherRecord",
      childTable: "Sheet2",
      relationType: "Many To many",
    });
    await dashboard.closeTab({ title: "Sheet1" });

    await dashboard.treeView.openTable({ title: "Sheet2" });
    await dashboard.grid.column.create({
      title: "Link2-1hm",
      type: "LinkToAnotherRecord",
      childTable: "Sheet1",
      relationType: "Has Many",
    });

    // Sheet2 now has all 3 column categories : HM, BT, MM
    //

    // Expanded form insert

    await dashboard.grid.toolbar.clickAddNewRow();
    await dashboard.expandedForm.fillField({
      columnTitle: "Title",
      value: "2a",
    });
    await dashboard.expandedForm.fillField({
      columnTitle: "Sheet1",
      value: "1a",
      type: "belongsTo",
    });
    await dashboard.expandedForm.fillField({
      columnTitle: "Sheet1 List",
      value: "1a",
      type: "manyToMany",
    });
    await dashboard.expandedForm.fillField({
      columnTitle: "Link2-1hm",
      value: "1a",
      type: "hasMany",
    });
    await dashboard.expandedForm.save();

    // In cell insert
    await dashboard.grid.addNewRow({ index: 1, value: "2b" });
    await dashboard.grid.cell.inCellAdd({ index: 1, columnHeader: "Sheet1" });
    await dashboard.linkRecord.select("1b");
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: "Sheet1 List",
    });
    await dashboard.linkRecord.select("1b");
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: "Link2-1hm",
    });
    await dashboard.linkRecord.select("1b");

    // Expand record insert
    await dashboard.grid.addNewRow({ index: 2, value: "2c-temp" });
    await dashboard.grid.openExpandedRow({ index: 2 });
    await dashboard.expandedForm.fillField({
      columnTitle: "Sheet1",
      value: "1c",
      type: "belongsTo",
    });
    await dashboard.expandedForm.fillField({
      columnTitle: "Sheet1 List",
      value: "1c",
      type: "manyToMany",
    });
    await dashboard.expandedForm.fillField({
      columnTitle: "Link2-1hm",
      value: "1c",
      type: "hasMany",
    });
    await dashboard.expandedForm.fillField({
      columnTitle: "Title",
      value: "2c",
      type: "text",
    });
    await dashboard.expandedForm.save();

    const expected = [
      [["1a"], ["1b"], ["1c"]],
      [["1a"], ["1b"], ["1c"]],
      [["1a"], ["1b"], ["1c"]],
    ];
    const colHeaders = ["Sheet1", "Sheet1 List", "Link2-1hm"];

    // verify LTAR cell values
    for (let i = 0; i < expected.length; i++) {
      for (let j = 0; j < expected[i].length; j++) {
        await dashboard.grid.cell.verifyVirtualCell({
          index: j,
          columnHeader: colHeaders[i],
          count: 1,
          value: expected[i][j],
        });
      }
    }

    await dashboard.closeTab({ title: "Sheet2" });
    await dashboard.treeView.openTable({ title: "Sheet1" });

    const expected2 = [
      [["2a"], ["2b"], ["2c"]],
      [["2a"], ["2b"], ["2c"]],
      [["2a"], ["2b"], ["2c"]],
    ];
    const colHeaders2 = ["Link1-2hm", "Link1-2mm", "Sheet2"];

    // verify LTAR cell values
    for (let i = 0; i < expected2.length; i++) {
      for (let j = 0; j < expected2[i].length; j++) {
        await dashboard.grid.cell.verifyVirtualCell({
          index: j,
          columnHeader: colHeaders2[i],
          count: 1,
          value: expected2[i][j],
        });
      }
    }

    // verify LTAR cell values
    for (let i = 0; i < expected2.length; i++) {
      for (let j = 0; j < expected2[i].length; j++) {
        await dashboard.grid.cell.unlinkVirtualCell({
          index: j,
          columnHeader: colHeaders2[i],
        });
      }
    }

    // delete columns
    await dashboard.grid.column.delete({ title: "Link1-2hm" });
    await dashboard.grid.column.delete({ title: "Link1-2mm" });
    await dashboard.grid.column.delete({ title: "Sheet2" });

    // delete table
    await dashboard.treeView.deleteTable({ title: "Sheet1" });
    await dashboard.treeView.deleteTable({ title: "Sheet2" });
  });
});
