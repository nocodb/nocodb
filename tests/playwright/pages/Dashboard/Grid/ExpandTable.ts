import BasePage from '../../Base';
import { GridPage } from './index';

export class ExpandTablePageObject extends BasePage {
  readonly grid: GridPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
  }

  async upsert() {
    const expandTableModal = this.rootPage.getByTestId('nc-expand-table-modal');

    await expandTableModal.isVisible();

    await expandTableModal.getByTestId('nc-table-expand-yes').click();

    await this.rootPage.getByTestId('nc-table-expand').click();
  }

  async updateOnly() {
    const expandTableModal = this.rootPage.getByTestId('nc-expand-table-modal');

    await expandTableModal.isVisible();

    await expandTableModal.getByTestId('nc-table-expand-no').click();

    await this.rootPage.getByTestId('nc-table-expand').click();
  }
}
