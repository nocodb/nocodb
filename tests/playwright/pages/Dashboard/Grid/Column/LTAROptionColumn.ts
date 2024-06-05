import { ColumnPageObject } from '.';
import BasePage from '../../../Base';
import { expect } from '@playwright/test';
import { LTARFilterPage } from './LTARFilterOption';

export class LTAROptionColumnPageObject extends BasePage {
  readonly column: ColumnPageObject;
  readonly filter: LTARFilterPage;

  constructor(column: ColumnPageObject) {
    super(column.rootPage);
    this.column = column;
    this.filter = new LTARFilterPage(this.rootPage);
  }

  get() {
    return this.column.get();
  }

  // add multiple options at once after column creation is completed
  //
  async addFilters(filters: Parameters<typeof LTARFilterPage.prototype.add>[0][]) {
    await this.get().getByTestId('nc-limit-record-filters').click();

    for (let i = 0; i < filters.length; i++) {
      await this.filter.add(filters[i]);
    }
  }

  async editFilter({
    columnTitle,
    ...filterUpdateParams
  }: { columnTitle: string } & Parameters<typeof LTARFilterPage.prototype.edit>[0]) {
    await this.column.openEdit({ title: columnTitle });

    await this.filter.edit(filterUpdateParams);
    await this.column.save({ isUpdated: true });
  }

  async deleteFilter({
    columnTitle,
    ...filterDeleteParams
  }: { index: number } & Parameters<typeof LTARFilterPage.prototype.delete>[0]) {
    await this.column.openEdit({ title: columnTitle });
    await this.filter.delete(filterDeleteParams);

    await this.column.save({ isUpdated: true });
  }

  async selectView({ ltarView }: { ltarView: string }) {
    await this.get().getByTestId('nc-limit-record-view').click();

    await this.rootPage.locator(`.nc-ltar-child-view >> input[type="search"]`).fill(ltarView);
    await this.rootPage
      .locator(`.nc-dropdown-ltar-child-view >> .ant-select-item`, {
        hasText: ltarView,
      })
      .nth(0)
      .click();
  }
}
