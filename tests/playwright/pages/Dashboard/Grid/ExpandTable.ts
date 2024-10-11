import BasePage from '../../Base';
import { GridPage } from './index';

export class ExpandTablePageObject extends BasePage {
  readonly grid: GridPage;

  constructor(grid: GridPage) {
    super(grid.rootPage);
    this.grid = grid;
  }

  async getExpandTable() {
    return this.rootPage.getByTestId('nc-expand-table-modal');
  }

  async upsert() {
    const expandTableModal = await this.getExpandTable();

    await expandTableModal.getByTestId('nc-table-expand-yes').click();

    await expandTableModal.getByTestId('nc-table-expand').click();
  }

  async updateOnly() {
    const expandTableModal = await this.getExpandTable();

    await expandTableModal.getByTestId('nc-table-expand-no').click();

    await expandTableModal.getByTestId('nc-table-expand').click();
  }
}
