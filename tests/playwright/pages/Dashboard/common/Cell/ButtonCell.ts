import { CellPageObject } from '.';
import BasePage from '../../../Base';

export class ButtonCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async select({ index, columnHeader }: { index: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async triggerWebhook({ index, columnHeader }: { index: number; columnHeader: string }) {
    await this.waitForResponse({
      uiAction: () => this.get({ index, columnHeader }).getByTestId('nc-button-cell').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: /\/hooks/,
      responseStatusCodeToMatch: 201,
    });
  }
}
