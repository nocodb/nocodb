import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { CellPageObject, CellProps } from '../common/Cell';
import { ColumnPageObject } from './Column';
import { TopbarPage } from '../common/Topbar';
import { ToolbarPage } from '../common/Toolbar';
import { FootbarPage } from '../common/Footbar';
import { ProjectMenuObject } from '../common/ProjectMenu';
import { QrCodeOverlay } from '../QrCodeOverlay';
import { BarcodeOverlay } from '../BarcodeOverlay';
import { RowPageObject } from './Row';
import { WorkspaceMenuObject } from '../common/WorkspaceMenu';
import { GroupPageObject } from './Group';
import { ColumnHeaderPageObject } from './columnHeader';

export class GridPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly dashboardPage: DashboardPage;
  readonly qrCodeOverlay: QrCodeOverlay;
  readonly barcodeOverlay: BarcodeOverlay;
  readonly columnHeader: ColumnHeaderPageObject;
  readonly column: ColumnPageObject;
  readonly cell: CellPageObject;
  readonly topbar: TopbarPage;
  readonly toolbar: ToolbarPage;
  readonly footbar: FootbarPage;
  readonly baseMenu: ProjectMenuObject;
  readonly workspaceMenu: WorkspaceMenuObject;
  readonly rowPage: RowPageObject;
  readonly groupPage: GroupPageObject;

  readonly btn_addNewRow: Locator;

  constructor(dashboardPage: DashboardPage) {
    super(dashboardPage.rootPage);
    this.dashboard = dashboardPage;
    this.addNewTableButton = dashboardPage.get().locator('.nc-add-new-table');
    this.qrCodeOverlay = new QrCodeOverlay(this);
    this.barcodeOverlay = new BarcodeOverlay(this);
    this.column = new ColumnPageObject(this);
    this.columnHeader = new ColumnHeaderPageObject(this);
    this.cell = new CellPageObject(this);
    this.topbar = new TopbarPage(this);
    this.toolbar = new ToolbarPage(this);
    this.footbar = new FootbarPage(this);
    this.baseMenu = new ProjectMenuObject(this);
    this.workspaceMenu = new WorkspaceMenuObject(this);
    this.rowPage = new RowPageObject(this);
    this.groupPage = new GroupPageObject(this);

    this.btn_addNewRow = this.get().locator('.nc-grid-add-new-cell');
  }

  async verifyLockMode() {
    // add new row button
    expect(await this.btn_addNewRow.count()).toBe(0);

    await this.toolbar.verifyLockMode();
    await this.footbar.verifyLockMode();
    await this.columnHeader.verifyLockMode();
  }

  async verifyCollaborativeMode() {
    // add new row button
    await expect(this.btn_addNewRow).toHaveCount(1);

    await this.toolbar.verifyCollaborativeMode();
    await this.footbar.verifyCollaborativeMode();
    await this.columnHeader.verifyCollaborativeMode();
  }

  get() {
    return this.dashboard.get().locator('[data-testid="nc-grid-wrapper"]');
  }

  row(index: number) {
    return this.get().locator(`tr[data-testid="grid-row-${index}"]`);
  }

  async rowCount() {
    return await this.get().locator('.nc-grid-row').count();
  }

  async verifyRowCount({ count }: { count: number }) {
    return await expect(this.get().locator('.nc-grid-row')).toHaveCount(count);
  }

  private async _fillRow({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const cell = this.cell.get({ index, columnHeader });
    await cell.waitFor({ state: 'visible' });
    await this.cell.dblclick({
      index,
      columnHeader,
    });
    await this.rootPage.waitForTimeout(500);

    await cell.locator('input').fill(value);
  }

  async addNewRow({
    index = 0,
    columnHeader = 'Title',
    value,
    networkValidation = true,
  }: {
    index?: number;
    columnHeader?: string;
    value?: string;
    networkValidation?: boolean;
  } = {}) {
    const rowValue = value ?? `Row ${index}`;
    // wait for render to complete before count
    if (index !== 0) await this.get().locator('.nc-grid-row').nth(0).waitFor({ state: 'attached' });

    await (await this.get().locator('.nc-grid-add-new-cell').elementHandle())?.waitForElementState('stable');

    await this.rootPage.waitForTimeout(200);
    await this.rootPage.waitForLoadState('networkidle');
    await this.rootPage.waitForTimeout(200);
    await this.rootPage.waitForLoadState('domcontentloaded');

    await this.get().locator('.nc-grid-add-new-cell').click();

    const rowCount = index + 1;
    await expect(this.get().locator('.nc-grid-row')).toHaveCount(rowCount);

    await this._fillRow({ index, columnHeader, value: rowValue });

    const clickOnColumnHeaderToSave = () =>
      this.get().locator(`[data-title="${columnHeader}"]`).locator(`div[data-test-id="${columnHeader}"]`).click();

    if (networkValidation) {
      await this.waitForResponse({
        uiAction: clickOnColumnHeaderToSave,
        requestUrlPathToMatch: 'api/v1/db/data/noco',
        httpMethodsToMatch: ['POST'],
        // numerical types are returned in number format from the server
        responseJsonMatcher: resJson => String(resJson?.[columnHeader]) === String(rowValue),
      });
    } else {
      await clickOnColumnHeaderToSave();
      await this.rootPage.waitForTimeout(300);
    }

    await this.rootPage.keyboard.press('Escape');
    await this.rootPage.waitForTimeout(300);

    await this.dashboard.waitForLoaderToDisappear();
  }

  async editRow({
    index = 0,
    columnHeader = 'Title',
    value,
    networkValidation = true,
  }: {
    index?: number;
    columnHeader?: string;
    value: string;
    networkValidation?: boolean;
  }) {
    await this._fillRow({ index, columnHeader, value });

    const clickOnColumnHeaderToSave = () =>
      this.get().locator(`[data-title="${columnHeader}"]`).locator(`div[data-test-id="${columnHeader}"]`).click();

    if (networkValidation) {
      await this.waitForResponse({
        uiAction: clickOnColumnHeaderToSave,
        requestUrlPathToMatch: 'api/v1/db/data/noco',
        httpMethodsToMatch: [
          'PATCH',
          // since edit row on an empty row will emit POST request
          'POST',
        ],
        // numerical types are returned in number format from the server
        responseJsonMatcher: resJson => String(resJson?.[columnHeader]) === String(value),
      });
    } else {
      await clickOnColumnHeaderToSave();
      await this.rootPage.waitForTimeout(300);
    }

    await this.rootPage.keyboard.press('Escape');
    await this.rootPage.waitForTimeout(300);

    await this.dashboard.waitForLoaderToDisappear();
  }

  async verifyRow({ index }: { index: number }) {
    await this.get().locator(`td[data-testid="cell-Title-${index}"]`).waitFor({ state: 'visible' });
    await expect(this.get().locator(`td[data-testid="cell-Title-${index}"]`)).toHaveCount(1);
  }

  async verifyRowDoesNotExist({ index }: { index: number }) {
    await this.get().locator(`td[data-testid="cell-Title-${index}"]`).waitFor({ state: 'hidden' });
    return await expect(this.get().locator(`td[data-testid="cell-Title-${index}"]`)).toHaveCount(0);
  }

  async deleteRow(index: number, title = 'Title') {
    await this.get().getByTestId(`cell-${title}-${index}`).click({
      button: 'right',
    });

    // Click text=Delete Row
    await this.rootPage.locator('.ant-dropdown-menu-item:has-text("Delete record")').click();

    // todo: improve selector
    await this.rootPage
      .locator('span.ant-dropdown-menu-title-content > nc-base-menu-item')
      .waitFor({ state: 'hidden' });

    await this.rootPage.waitForTimeout(300);
    await this.dashboard.waitForLoaderToDisappear();
  }

  async addRowRightClickMenu(index: number, columnHeader = 'Title') {
    const rowCount = await this.get().locator('.nc-grid-row').count();

    const cell = this.get().locator(`td[data-testid="cell-${columnHeader}-${index}"]`).last();
    await cell.click();
    await cell.click({ button: 'right' });

    // Click text=Insert New Row
    await this.rootPage.locator('.insert-row').click();
    await expect(this.get().locator('.nc-grid-row')).toHaveCount(rowCount + 1);
  }

  async openExpandedRow({ index }: { index: number }) {
    await this.row(index).locator(`td[data-testid="cell-Id-${index}"]`).hover();
    await this.row(index).locator(`div[data-testid="nc-expand-${index}"]`).click();
  }

  async selectRow(index: number) {
    const cell: Locator = this.get().locator(`td[data-testid="cell-Id-${index}"]`);
    await cell.hover();
    await cell.locator('input[type="checkbox"]').check({ force: true });
  }

  async selectAll() {
    await this.get().locator('[data-testid="nc-check-all"]').hover();

    await this.get().locator('[data-testid="nc-check-all"]').locator('input[type="checkbox"]').check({
      force: true,
    });

    const rowCount = await this.rowCount();
    for (let i = 0; i < rowCount; i++) {
      await expect(
        this.row(i).locator(`[data-testid="cell-Id-${i}"]`).locator('span.ant-checkbox-checked')
      ).toHaveCount(1);
    }
    await this.rootPage.waitForTimeout(300);
  }

  async openAllRowContextMenu() {
    await this.get().locator('[data-testid="nc-check-all"]').nth(0).click({
      button: 'right',
    });
  }

  async deleteSelectedRows() {
    await this.get().locator('[data-testid="nc-check-all"]').nth(0).click({
      button: 'right',
    });
    await this.rootPage.locator('[data-testid="nc-delete-row"]').click();
    await this.dashboard.waitForLoaderToDisappear();
  }

  async deleteAll() {
    await this.selectAll();
    await this.deleteSelectedRows();
  }

  async updateSelectedRows() {
    await this.get().locator('[data-testid="nc-check-all"]').nth(0).click({
      button: 'right',
    });
    await this.rootPage.locator('.nc-menu-item:has-text("Update Selected Records")').click();
    await this.dashboard.waitForLoaderToDisappear();
  }

  async updateAll() {
    await this.selectAll();
    await this.updateSelectedRows();
  }

  async verifyTotalRowCount({ count }: { count: number }) {
    // wait for 100 ms and try again : 5 times
    let i = 0;
    await this.get().locator(`.nc-pagination`).waitFor();
    let records = await this.get().locator(`[data-testid="grid-pagination"]`).allInnerTexts();
    let recordCnt = records[0].split(' ')[0];

    while (parseInt(recordCnt) !== count && i < 5) {
      await this.get().locator(`.nc-pagination`).waitFor();
      records = await this.get().locator(`[data-testid="grid-pagination"]`).allInnerTexts();
      recordCnt = records[0].split(' ')[0];

      // to ensure page loading is complete
      i++;
      await this.rootPage.waitForTimeout(100 * i);
    }
    expect(parseInt(recordCnt)).toEqual(count);
  }

  async verifyPaginationCount({ count }: { count: string }) {
    await expect(this.get().locator(`.nc-pagination .total`)).toHaveText(count);
  }

  async clickPagination({
    type,
    skipWait = false,
  }: {
    type: 'first-page' | 'last-page' | 'next-page' | 'prev-page';
    skipWait?: boolean;
  }) {
    if (!skipWait) {
      await this.get().locator(`.nc-pagination .${type}`).click();
      await this.waitLoading();
    } else {
      await this.waitForResponse({
        uiAction: async () => (await this.get().locator(`.nc-pagination .${type}`)).click(),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: '/views/',
        responseJsonMatcher: resJson => resJson?.pageInfo,
      });

      await this.waitLoading();
    }
  }

  async verifyActivePage({ pageNumber }: { pageNumber: string }) {
    await expect(this.get().locator(`.nc-pagination .ant-select-selection-item`)).toHaveText(pageNumber);
  }

  async waitLoading() {
    await this.dashboard.get().locator('[data-testid="grid-load-spinner"]').waitFor({ state: 'hidden' });
  }

  async verifyEditDisabled({ columnHeader = 'Title' }: { columnHeader?: string } = {}) {
    // double click to toggle to edit mode
    const cell = this.cell.get({ index: 0, columnHeader: columnHeader });
    await this.cell.dblclick({
      index: 0,
      columnHeader: columnHeader,
    });
    await expect(cell.locator('input')).not.toBeVisible();

    // right click menu
    await this.get().locator(`td[data-testid="cell-${columnHeader}-0"]`).click({
      button: 'right',
    });
    // await expect(this.rootPage.locator('text=Insert New Row')).not.toBeVisible();

    // in cell-add
    await this.cell.get({ index: 0, columnHeader: 'Cities' }).hover();
    await expect(
      this.cell.get({ index: 0, columnHeader: 'Cities' }).locator('.nc-action-icon.nc-plus')
    ).not.toBeVisible();

    // expand row
    await this.cell.get({ index: 0, columnHeader: 'Cities' }).hover();
    await expect(
      this.cell.get({ index: 0, columnHeader: 'Cities' }).locator('.nc-action-icon >> nth=0')
    ).not.toBeVisible();
  }

  async verifyEditEnabled({ columnHeader = 'Title' }: { columnHeader?: string } = {}) {
    // double click to toggle to edit mode
    const cell = this.cell.get({ index: 0, columnHeader: columnHeader });
    await this.cell.dblclick({
      index: 0,
      columnHeader: columnHeader,
    });
    await expect(cell.locator('input')).toBeVisible();

    // press escape to exit edit mode
    await cell.press('Escape');

    // right click menu
    await this.get().locator(`td[data-testid="cell-${columnHeader}-0"]`).click({
      button: 'right',
    });
    // await expect(this.rootPage.locator('text=Insert New Row')).toBeVisible();

    // in cell-add
    await this.cell.get({ index: 0, columnHeader: 'Cities' }).hover();
    await expect(this.cell.get({ index: 0, columnHeader: 'Cities' }).locator('.nc-action-icon.nc-plus')).toBeVisible();
  }

  async verifyRoleAccess(param: { role: string }) {
    await this.column.verifyRoleAccess(param);
    await this.cell.verifyRoleAccess(param);
    await this.toolbar.verifyRoleAccess(param);
    await this.footbar.verifyRoleAccess(param);
  }

  async selectRange({ start, end }: { start: CellProps; end: CellProps }) {
    const startCell = this.cell.get({ index: start.index, columnHeader: start.columnHeader });
    const endCell = this.cell.get({ index: end.index, columnHeader: end.columnHeader });
    const page = this.dashboard.get().page();
    await startCell.hover();
    await page.mouse.down();
    await endCell.hover();
    await page.mouse.up();
  }

  async selectedCount() {
    return this.get().locator('.cell.active').count();
  }

  async copyWithKeyboard() {
    // retry to avoid flakiness, until text is copied to clipboard
    //
    let text = '';
    let retryCount = 5;
    while (text === '') {
      await this.get().press((await this.isMacOs()) ? 'Meta+C' : 'Control+C');
      await this.verifyToast({ message: 'Copied to clipboard' });
      text = await this.getClipboardText();

      // retry if text is empty till count is reached
      retryCount--;
      if (0 === retryCount) {
        break;
      }
    }
    return text;
  }

  async copyWithMouse({ index, columnHeader }: CellProps) {
    // retry to avoid flakiness, until text is copied to clipboard
    //
    let text = '';
    let retryCount = 5;
    while (text === '') {
      await this.cell.get({ index, columnHeader }).click({ button: 'right' });
      await this.get().page().getByTestId('context-menu-item-copy').click();
      await this.verifyToast({ message: 'Copied to clipboard' });
      text = await this.getClipboardText();

      // retry if text is empty till count is reached
      retryCount--;
      if (0 === retryCount) {
        break;
      }
    }
    return text;
  }
}
