import BasePage from '../../Base';
import { expect, Locator } from '@playwright/test';
import { DetailsPage } from './index';

export class ErdPage extends BasePage {
  readonly detailsPage: DetailsPage;

  readonly contextMenuBase: Locator;
  readonly contextMenu = {};

  readonly btn_fullScreen: Locator;
  readonly btn_zoomIn: Locator;
  readonly btn_zoomOut: Locator;

  constructor(details: DetailsPage) {
    super(details.rootPage);
    this.detailsPage = details;
    this.btn_fullScreen = this.get().locator('.nc-erd-histogram > .nc-icon');
    this.btn_zoomIn = this.get().locator('.nc-erd-zoom-btn').nth(0);
    this.btn_zoomOut = this.get().locator('.nc-erd-zoom-btn').nth(1);

    this.contextMenuBase = this.get().locator('.nc-erd-context-menu');
    this.contextMenu['Show Columns'] = this.contextMenuBase.locator('.ant-checkbox-wrapper').nth(0);
    this.contextMenu['Show Primary and Foreign Keys'] = this.contextMenuBase.locator('.ant-checkbox-wrapper').nth(1);
    this.contextMenu['Show SQL Views'] = this.contextMenuBase.locator('.ant-checkbox-wrapper').nth(2);
  }

  get() {
    // pop up when triggered from data sources page
    return this.rootPage.locator('.vue-flow');
  }

  async verifyNode({
    tableName,
    columnName,
    columnNameShouldNotExist,
  }: {
    tableName: string;
    columnName?: string;
    columnNameShouldNotExist?: string;
  }) {
    await this.get().locator(`.nc-erd-table-node-${tableName}`).scrollIntoViewIfNeeded();

    await this.get().locator(`.nc-erd-table-node-${tableName}`).waitFor({ state: 'visible' });
    if (columnName) {
      await this.get().locator(`.nc-erd-table-node-${tableName}-column-${columnName}`).waitFor({ state: 'visible' });
    }
    if (columnNameShouldNotExist) {
      await this.get()
        .locator(`.nc-erd-table-node-${tableName}-column-${columnNameShouldNotExist}`)
        .waitFor({ state: 'hidden' });
    }
  }

  async verifyNodeDoesNotExist({ tableName }: { tableName: string }) {
    await this.get().locator(`.nc-erd-table-node-${tableName}`).waitFor({ state: 'hidden' });
  }

  async verifyColumns({ tableName, columns }: { tableName: string; columns: string[] }) {
    for (const column of columns) {
      await this.verifyNode({ tableName, columnName: column });
    }
  }

  async verifyNodesCount(count: number) {
    await expect(this.get().locator('.nc-erd-table-node')).toHaveCount(count);
  }

  async verifyEdgesCount({
    count,
    circleCount,
    rectangleCount,
  }: {
    count: number;
    circleCount: number;
    rectangleCount: number;
  }) {
    await expect(this.get().locator('.vue-flow__edge')).toHaveCount(count);
    await expect(this.get().locator('.nc-erd-edge-circle')).toHaveCount(circleCount);
    await expect(this.get().locator('.nc-erd-edge-rect')).toHaveCount(rectangleCount);
  }

  async verifyJunctionTableLabel({ tableTitle, tableName }: { tableName: string; tableTitle: string }) {
    await this.get().locator(`.nc-erd-table-label-${tableTitle}-${tableName}`).waitFor({
      state: 'visible',
    });
  }

  async clickShowColumnNames() {
    await this.contextMenu['Show Columns'].click();
    await (await this.get().elementHandle())?.waitForElementState('stable');
  }

  async clickShowPkAndFk() {
    await this.contextMenu['Show Primary and Foreign Keys'].click();
    await (await this.get().elementHandle())?.waitForElementState('stable');
  }

  async clickShowSqlViews() {
    await this.contextMenu['Show SQL Views'].click();
    await (await this.get().elementHandle())?.waitForElementState('stable');
  }

  async close() {
    await this.get().click();
    await this.rootPage.keyboard.press('Escape');
    await this.get().waitFor({ state: 'hidden' });
  }
}
