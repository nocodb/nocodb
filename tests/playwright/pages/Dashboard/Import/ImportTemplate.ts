import { expect, Locator } from '@playwright/test';
import BasePage from '../../Base';
import { DashboardPage } from '..';
import { getTextExcludeIconText } from '../../../tests/utils/general';

export class ImportTemplatePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly importButton: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.importButton = dashboard.get().locator('.nc-btn-import');
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-quick-import`);
  }

  async getImportTableList() {
    await this.get().locator(`.ant-collapse-header`).nth(0).waitFor();
    const tr = this.get().locator(`.ant-collapse-header`);
    const rowCount = await tr.count();
    const tableList: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      const tableName = await this.get()
        .locator(`.ant-collapse-header`)
        .nth(i)
        .locator('input[type="text"]')
        .inputValue();
      tableList.push(tableName);
    }
    return tableList;
  }

  async getImportColumnList() {
    // return an array
    const columnList: { type: string; name: string }[] = [];
    const tr = this.get().locator(`tr.nc-table-row:visible`);
    const rowCount = await tr.count();
    for (let i = 1; i < rowCount; i++) {
      // we start from 1 because the first tr holds the select all toggle
      // replace \n and \t from innerText
      // const columnType = (await getTextExcludeIconText(tr.nth(i))).replace(/\n|\t/g, '');
      const columnType = 'SingleLineText'; // all columsn are treated as SingleLineText for now since we have removed the type column
      const columnName = await tr.nth(i).locator(`.nc-import-table-field-name`).textContent();
      columnList.push({ type: columnType, name: columnName });
    }
    return columnList;
  }

  // todo: Add polling logic to assertions
  async import({ file, result }: { file: string; result: any }) {
    const importFile = this.get().locator(`input[type="file"]`);
    await importFile.setInputFiles(file);
    await this.importButton.click();

    const tblList = await this.getImportTableList();
    for (let i = 0; i < result.length; i++) {
      expect(tblList[i]).toBe(result[i].name);
      const columnList = await this.getImportColumnList();
      expect(columnList).toEqual(result[i].columns);
      if (i < result.length - 1) {
        await this.expandTableList({ index: i + 1 });
      }
    }

    await this.get().locator('button:has-text("Back"):visible').waitFor();
    await this.waitForResponse({
      requestUrlPathToMatch: '/api/v1/db/data/bulk/',
      httpMethodsToMatch: ['POST'],
      uiAction: () => this.get().locator('button:has-text("Import"):visible').click(),
    });
  }

  private async expandTableList(param: { index: number }) {
    await this.get().locator(`.ant-collapse-header`).nth(param.index).click();
    await this.rootPage.waitForTimeout(1000);
  }
}
