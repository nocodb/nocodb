import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { CellPageObject, CellProps } from '../common/Cell';
import { ColumnPageObject } from './Column';
import { ToolbarPage } from '../common/Toolbar';
import { ProjectMenuObject } from '../common/ProjectMenu';
import { QrCodeOverlay } from '../QrCodeOverlay';
import { BarcodeOverlay } from '../BarcodeOverlay';
import { RowPageObject } from './Row';

export class GridPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly addNewTableButton: Locator;
  readonly dashboardPage: DashboardPage;
  readonly qrCodeOverlay: QrCodeOverlay;
  readonly barcodeOverlay: BarcodeOverlay;
  readonly column: ColumnPageObject;
  readonly cell: CellPageObject;
  readonly toolbar: ToolbarPage;
  readonly projectMenu: ProjectMenuObject;
  readonly rowPage: RowPageObject;

  constructor(dashboardPage: DashboardPage) {
    super(dashboardPage.rootPage);
    this.dashboard = dashboardPage;
    this.addNewTableButton = dashboardPage.get().locator('.nc-add-new-table');
    this.qrCodeOverlay = new QrCodeOverlay(this);
    this.barcodeOverlay = new BarcodeOverlay(this);
    this.column = new ColumnPageObject(this);
    this.cell = new CellPageObject(this);
    this.toolbar = new ToolbarPage(this);
    this.projectMenu = new ProjectMenuObject(this);
    this.rowPage = new RowPageObject(this);
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
    await this.cell.dblclick({
      index,
      columnHeader,
    });

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
    const rowCount = await this.get().locator('.nc-grid-row').count();
    await this.get().locator('.nc-grid-add-new-cell').click();

    await expect(this.get().locator('.nc-grid-row')).toHaveCount(rowCount + 1);

    await this._fillRow({ index, columnHeader, value: rowValue });

    const clickOnColumnHeaderToSave = () =>
      this.get().locator(`[data-title="${columnHeader}"]`).locator(`span[title="${columnHeader}"]`).click();

    if (networkValidation) {
      await this.waitForResponse({
        uiAction: clickOnColumnHeaderToSave,
        requestUrlPathToMatch: 'api/v1/db/data/noco',
        httpMethodsToMatch: ['POST'],
        responseJsonMatcher: resJson => resJson?.[columnHeader] === rowValue,
      });
    } else {
      await clickOnColumnHeaderToSave();
      await this.rootPage.waitForTimeout(300);
    }

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
      this.get().locator(`[data-title="${columnHeader}"]`).locator(`span[title="${columnHeader}"]`).click();

    if (networkValidation) {
      await this.waitForResponse({
        uiAction: clickOnColumnHeaderToSave,
        requestUrlPathToMatch: 'api/v1/db/data/noco',
        httpMethodsToMatch: [
          'PATCH',
          // since edit row on an empty row will emit POST request
          'POST',
        ],
        responseJsonMatcher: resJson => resJson?.[columnHeader] === value,
      });
    } else {
      await clickOnColumnHeaderToSave();
      await this.rootPage.waitForTimeout(300);
    }

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
    await this.rootPage.locator('text=Delete Row').click();
    // todo: improve selector
    await this.rootPage
      .locator('span.ant-dropdown-menu-title-content > nc-project-menu-item')
      .waitFor({ state: 'hidden' });

    await this.rootPage.waitForTimeout(300);
    await this.dashboard.waitForLoaderToDisappear();
  }

  async addRowRightClickMenu(index: number) {
    const rowCount = await this.get().locator('.nc-grid-row').count();
    await this.get().locator(`td[data-testid="cell-Title-${index}"]`).click({
      button: 'right',
    });
    // Click text=Insert New Row
    await this.rootPage.locator('text=Insert New Row').click();
    await expect(await this.get().locator('.nc-grid-row')).toHaveCount(rowCount + 1);
  }

  async openExpandedRow({ index }: { index: number }) {
    await this.row(index).locator(`td[data-testid="cell-Id-${index}"]`).hover();
    await this.row(index).locator(`div[data-testid="nc-expand-${index}"]`).click();
    await (await this.rootPage.locator('.ant-drawer-body').elementHandle())?.waitForElementState('stable');
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

  async deleteAll() {
    await this.selectAll();
    await this.get().locator('[data-testid="nc-check-all"]').nth(0).click({
      button: 'right',
    });
    await this.rootPage.locator('text=Delete Selected Rows').click();
    await this.dashboard.waitForLoaderToDisappear();
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

  private async pagination({ page }: { page: string }) {
    await this.get().locator(`.nc-pagination`).waitFor();

    if (page === '<') return this.get().locator('.nc-pagination > .ant-pagination-prev');
    if (page === '>') return this.get().locator('.nc-pagination > .ant-pagination-next');

    return this.get().locator(`.nc-pagination > .ant-pagination-item.ant-pagination-item-${page}`);
  }

  async clickPagination({ page }: { page: string }) {
    await this.waitForResponse({
      uiAction: async () => (await this.pagination({ page })).click(),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: '/views/',
      responseJsonMatcher: resJson => resJson?.pageInfo,
    });

    await this.waitLoading();
  }

  async verifyActivePage({ page }: { page: string }) {
    await expect(await this.pagination({ page })).toHaveClass(/ant-pagination-item-active/);
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
    await expect(await cell.locator('input')).not.toBeVisible();

    // right click menu
    await this.get().locator(`td[data-testid="cell-${columnHeader}-0"]`).click({
      button: 'right',
    });
    await expect(await this.rootPage.locator('text=Insert New Row')).not.toBeVisible();

    // in cell-add
    await this.cell.get({ index: 0, columnHeader: 'City List' }).hover();
    await expect(
      await this.cell.get({ index: 0, columnHeader: 'City List' }).locator('.nc-action-icon.nc-plus')
    ).not.toBeVisible();

    // expand row
    await this.cell.get({ index: 0, columnHeader: 'City List' }).hover();
    await expect(
      await this.cell.get({ index: 0, columnHeader: 'City List' }).locator('.nc-action-icon >> nth=0')
    ).not.toBeVisible();
  }

  async verifyEditEnabled({ columnHeader = 'Title' }: { columnHeader?: string } = {}) {
    // double click to toggle to edit mode
    const cell = this.cell.get({ index: 0, columnHeader: columnHeader });
    await this.cell.dblclick({
      index: 0,
      columnHeader: columnHeader,
    });
    await expect(await cell.locator('input')).toBeVisible();

    // press escape to exit edit mode
    await cell.press('Escape');

    // right click menu
    await this.get().locator(`td[data-testid="cell-${columnHeader}-0"]`).click({
      button: 'right',
    });
    await expect(await this.rootPage.locator('text=Insert New Row')).toBeVisible();

    // in cell-add
    await this.cell.get({ index: 0, columnHeader: 'City List' }).hover();
    await expect(
      await this.cell.get({ index: 0, columnHeader: 'City List' }).locator('.nc-action-icon.nc-plus')
    ).toBeVisible();

    // expand row
    await this.cell.get({ index: 0, columnHeader: 'City List' }).hover();
    await expect(
      await this.cell.get({ index: 0, columnHeader: 'City List' }).locator('.nc-action-icon.nc-arrow-expand')
    ).toBeVisible();
  }

  async validateRoleAccess(param: { role: string }) {
    await this.column.verifyRoleAccess(param);
    await this.cell.verifyRoleAccess(param);
    await expect(this.get().locator('.nc-grid-add-new-cell')).toHaveCount(
      param.role === 'creator' || param.role === 'editor' ? 1 : 0
    );
  }

  async selectRange({ start, end }: { start: CellProps; end: CellProps }) {
    const startCell = await this.cell.get({ index: start.index, columnHeader: start.columnHeader });
    const endCell = await this.cell.get({ index: end.index, columnHeader: end.columnHeader });
    const page = await this.dashboard.get().page();
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
