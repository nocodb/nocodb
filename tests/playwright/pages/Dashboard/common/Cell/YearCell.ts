import { CellPageObject } from '.';
import BasePage from '../../../Base';
import { expect } from '@playwright/test';

export class YearCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async verify({ index, columnHeader, value }: { index: number; columnHeader: string; value: number }) {
    const cell = this.get({ index, columnHeader });
    await cell.scrollIntoViewIfNeeded();
    await cell.locator(`input[title="${value}"]`).waitFor({ state: 'visible' });
    await expect(cell.locator(`[title="${value}"]`)).toBeVisible();
  }
}
