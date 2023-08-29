import { CellPageObject } from '.';
import BasePage from '../../../Base';
import { expect } from '@playwright/test';

export class TimeCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async verify({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const cell = this.get({ index, columnHeader });
    await cell.scrollIntoViewIfNeeded();
    await cell.locator(`input[title="${value}"]`).waitFor({ state: 'visible' });
    await expect(cell.locator(`[title="${value}"]`)).toBeVisible();
  }

  async selectTime({
    // hour: 0 - 23
    // minute: 0 - 59
    // second: 0 - 59
    hour,
    minute,
  }: {
    hour: number;
    minute: number;
  }) {
    const timePanel = this.rootPage.locator('.ant-picker-time-panel-column');
    await timePanel.nth(0).locator('.ant-picker-time-panel-cell').nth(hour).click();
    await timePanel.nth(1).locator('.ant-picker-time-panel-cell').nth(minute).click();
    if (hour < 12) {
      await timePanel.nth(2).locator('.ant-picker-time-panel-cell').nth(0).click();
    } else {
      await timePanel.nth(2).locator('.ant-picker-time-panel-cell').nth(1).click();
    }
  }

  async save() {
    await this.rootPage.locator('button:has-text("Ok"):visible').click();
  }

  async set({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const [hour, minute, _second] = value.split(':');
    await this.get({ index, columnHeader }).click();
    await this.get({ index, columnHeader }).click();
    await this.selectTime({ hour: +hour, minute: +minute });
    await this.save();
  }
}
