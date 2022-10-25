// playwright-dev-page.ts
import { expect, Locator } from "@playwright/test";
import BasePage from "../../Base";
import { DashboardPage } from "..";

export class ImportTemplatePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly importButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.importButton = dashboard.get().locator(".nc-btn-import");
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-quick-import`);
  }

  async getImportTableList() {
    await this.get().locator(`.ant-collapse-header`).nth(0).waitFor();
    let tr = await this.get().locator(`.ant-collapse-header`);
    let rowCount = await tr.count();
    let tableList = [];
    for (let i = 0; i < rowCount; i++) {
      let tableName = await tr.nth(i).innerText();
      tableList.push(tableName);
    }
    return tableList;
  }

  async getImportColumnList() {
    // return an array
    let columnList = [];
    let tr = await this.get().locator(`tr.ant-table-row-level-0:visible`);
    let rowCount = await tr.count();
    for (let i = 0; i < rowCount; i++) {
      // replace \n and \t from innerText
      let columnType = await tr
        .nth(i)
        .innerText()
        .then((text) => text.replace(/\n|\t/g, ""));
      let columnName = await tr
        .nth(i)
        .locator(`input[type="text"]`)
        .inputValue();
      columnList.push({ type: columnType, name: columnName });
    }
    return columnList;
  }

  async import({ file, result }: { file: string; result: any }) {
    let importFile = this.get().locator(`input[type="file"]`);
    await importFile.setInputFiles(file);
    await this.importButton.click();

    let tblList = await this.getImportTableList();
    for (let i = 0; i < result.length; i++) {
      expect(tblList[i]).toBe(result[i].name);
      let columnList = await this.getImportColumnList();
      expect(columnList).toEqual(result[i].columns);
      if (i < result.length - 1) {
        await this.expandTableList({ index: i + 1 });
      }
    }

    await this.get().locator('button:has-text("Back"):visible').waitFor();
    await this.get().locator('button:has-text("Import"):visible').click();
  }

  private async expandTableList(param: { index: number }) {
    await this.get().locator(`.ant-collapse-header`).nth(param.index).click();
    await this.rootPage.waitForTimeout(1000);
  }
}
