import BasePage from '../../Base';
import { GridPage } from './index';

export class ExpandTablePageObject extends BasePage {
  readonly grid: GridPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
  }

  get() {
    return this.rootPage.getByTestId('nc-expand-upsert-modal');
  }

  async upsert() {
    const expandTableModal = this.get();

    await expandTableModal.waitFor({ state: 'visible' });

    await expandTableModal.getByTestId('nc-table-expand-yes').click();

    await this.rootPage.getByTestId('nc-table-expand').click();
  }

  async updateOnly() {
    const expandTableModal = this.get();

    await expandTableModal.waitFor({ state: 'visible' });

    await expandTableModal.getByTestId('nc-table-expand-no').click();

    await this.rootPage.getByTestId('nc-table-expand').click();
  }
}
