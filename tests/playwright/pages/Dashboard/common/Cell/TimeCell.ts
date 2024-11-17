import { CellPageObject } from '.';
import BasePage from '../../../Base';
import { expect, Locator } from '@playwright/test';

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
    await cell.locator(`.nc-time-picker[title="${value}"]`).waitFor({ state: 'visible' });
    await expect(cell.locator(`[title="${value}"]`)).toBeVisible();
  }

  async selectTime({
    // hour: 0 - 23
    // minute: 0 - 59
    // second: 0 - 59
    hour,
    minute,
    fillValue,
    locator,
    selectFromPicker = false,
  }: {
    hour: number;
    minute: number;
    fillValue: string;
    locator: Locator;
    selectFromPicker?: boolean;
  }) {
    const timeInput = locator.locator('.nc-time-input');
    await timeInput.click();

    const dropdown = this.rootPage.locator('.nc-picker-time.active');
    await dropdown.waitFor({ state: 'visible' });

    if (!selectFromPicker) {
      await timeInput.fill(fillValue);

      await this.rootPage.keyboard.press('Shift+Enter');
      await this.rootPage.keyboard.press('Escape');
    } else {
      await dropdown
        .locator(`[data-testid="time-option-${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}"]`)
        .scrollIntoViewIfNeeded();
      await dropdown
        .locator(`[data-testid="time-option-${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}"]`)
        .click();
    }
    await dropdown.waitFor({ state: 'hidden' });
  }

  async save() {
    await this.rootPage.locator('button:has-text("Ok"):visible').click();
  }

  async set({ index, columnHeader, value }: { index: number; columnHeader: string; value: string }) {
    const [hour, minute, _second] = value.split(':');
    await this.get({ index, columnHeader }).click();
    await this.get({ index, columnHeader }).dblclick();
    await this.selectTime({
      hour: +hour,
      minute: +minute,
      fillValue: value,
      locator: this.get({ index, columnHeader }),
      selectFromPicker: +minute === 0 || +minute === 30,
    });
  }
}
