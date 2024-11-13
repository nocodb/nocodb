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
import { AggregaionBarPage } from './AggregationBar';
import { ExpandTablePageObject } from './ExpandTable';

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
  readonly aggregationBar: AggregaionBarPage;
  readonly expandTableOverlay: ExpandTablePageObject;

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
    this.aggregationBar = new AggregaionBarPage(this);
    this.expandTableOverlay = new ExpandTablePageObject(this);

    this.btn_addNewRow = this.get().locator('.nc-grid-add-new-cell');
  }

  async verifyLockMode() {
    // add new row button
    expect(await this.btn_addNewRow.count()).toBe(1);

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

  async verifyPersonalMode() {
    // add new row button
    expect(await this.btn_addNewRow.count()).toBe(1);

    // the behaviour is same as lock mode
    await this.toolbar.verifyPersonalMode();
    await this.footbar.verifyPersonalMode();
    await this.columnHeader.verifyPersonalMode();
  }

  get() {
    return this.dashboard.get().locator('[data-testid="nc-grid-wrapper"]');
  }

  row(index: number) {
    return this.get().locator(`tr[data-testid="grid-row-${index}"]`);
  }

  async renderColumn(columnHeader: string) {
    // we have virtual grid, so we need to make sure the column is rendered
    const headerRow = this.get().locator('.nc-grid-header').first();
    let column = headerRow.locator(`[data-title="${columnHeader}"]`);
    let lastScrolledColumn: Locator = null;
    let direction = 'right';

    while (headerRow) {
      try {
        await column.elementHandle({ timeout: 1000 });
        break;
      } catch {}

      const lastColumn =
        direction === 'right'
          ? headerRow.locator('th.nc-grid-column-header').last()
          : headerRow.locator('th.nc-grid-column-header').nth(1);

      if (lastScrolledColumn) {
        if ((await lastScrolledColumn.innerText()) === (await lastColumn.innerText())) {
          if (direction === 'right') {
            direction = 'left';
            lastScrolledColumn = null;
          } else {
            throw new Error(`Column with header "${columnHeader}" not found`);
          }
        }
      }

      await lastColumn.scrollIntoViewIfNeeded();

      lastScrolledColumn = lastColumn;

      column = headerRow.locator(`[data-title="${columnHeader}"]`);
    }
  }

  async rowCount() {
    return await this.get().locator('.nc-grid-row').count();
  }

  async verifyRowCount({ count }: { count: number }) {
    return await expect(this.get().locator('.nc-grid-row')).toHaveCount(count);
  }

  private async _fillRow({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const cell = this.cell.get({ index, columnHeader });
    await expect(cell).toBeVisible();
    await this.rootPage.waitForTimeout(500);
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

    const isRowSaving = this.rootPage.getByTestId(`row-save-spinner-${rowCount}`);
    // if required field is present then isRowSaving will be hidden (not present in DOM)
    await isRowSaving?.waitFor({ state: 'hidden' });

    // fallback
    await this.rootPage.waitForTimeout(400);

    await expect(this.get().locator(`[data-testid="grid-row-${rowCount - 1}"]`)).toHaveCount(1);

    await this.rootPage.waitForLoadState('networkidle');

    await this._fillRow({ index, columnHeader, value: rowValue });

    const clickOnColumnHeaderToSave = () =>
      this.get().locator(`[data-title="${columnHeader}"]`).locator(`span[data-test-id="${columnHeader}"]`).click();

    if (networkValidation) {
      await this.waitForResponse({
        uiAction: clickOnColumnHeaderToSave,
        requestUrlPathToMatch: 'api/v1/db/data/noco',
        httpMethodsToMatch: [
          // if the row does not contain the required cell, editing the row cell will emit a PATCH request; otherwise, it will emit a POST request.
          'PATCH',
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
      this.get().locator(`[data-title="${columnHeader}"]`).locator(`span[data-test-id="${columnHeader}"]`).click();

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

  async clickRow(index: number, title = 'Title') {
    await this.get().getByTestId(`cell-${title}-${index}`).click();
    await this.rootPage.waitForTimeout(300);
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
    await this.get().locator(`.nc-pagination-skeleton`).waitFor({ state: 'hidden' });
    let records = await this.get().locator(`[data-testid="grid-pagination"]`).allInnerTexts();
    let recordCnt = records[0].split(' ')[0];

    while (parseInt(recordCnt) !== count && i < 5) {
      await this.get().locator(`.nc-pagination-skeleton`).waitFor({ state: 'hidden' });
      records = await this.get().locator(`[data-testid="grid-pagination"]`).allInnerTexts();
      recordCnt = (records[0] ?? '').split(' ')[0];

      // to ensure page loading is complete
      i++;
      await this.rootPage.waitForTimeout(100 * i);
    }
    expect(parseInt(recordCnt)).toEqual(count);
  }

  async verifyPaginationCount({ count }: { count: string }) {
    if (await this.get().locator('.nc-pagination').isHidden()) {
      expect(1).toBe(+count);
      return;
    }

    await expect(this.get().locator(`.nc-pagination .total`)).toHaveText(count);
  }

  async clickPagination(_params: { type: 'first-page' | 'last-page' | 'next-page' | 'prev-page'; skipWait?: boolean }) {
    // No longer required due to implementation of InfiniteScroll
    return;
  }

  async verifyActivePage(_params: { pageNumber: string }) {
    return;
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

  async getActiveCell() {
    return this.get().locator('.cell.active');
  }

  async verifySelectedCellCount({ count }: { count: number }) {
    await expect(this.get().locator('.cell.active')).toHaveCount(count);
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

  async pasteWithMouse({ index, columnHeader }: CellProps) {
    await this.cell.get({ index, columnHeader }).scrollIntoViewIfNeeded();
    await this.cell.get({ index, columnHeader }).click({ button: 'right' });

    await this.get().page().getByTestId('context-menu-item-paste').click();

    // kludge: wait for paste to complete
    await this.rootPage.waitForTimeout(1000);
  }

  async clearWithMouse({ index, columnHeader }: CellProps) {
    await this.cell.get({ index, columnHeader }).click({ button: 'right' });
    await this.get().page().getByTestId('context-menu-item-clear').click();
  }
}
