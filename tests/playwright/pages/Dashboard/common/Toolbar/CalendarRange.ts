import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { getTextExcludeIconText } from '../../../../tests/utils/general';
import { expect } from '@playwright/test';

export class ToolbarCalendarRangePage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.getByTestId('nc-calendar-range-menu');
  }

  async click({ title }: { title: string }) {
    await this.get().getByTestId('nc-calendar-range-from-field-select').click();
    await this.rootPage.locator('.ant-select-dropdown:visible').locator(`div[title="${title}"]`).click();
  }

  async newCalendarRange({ fromTitle, toTitle }: { fromTitle: string; toTitle?: string }) {
    await this.get().getByTestId(`nc-calendar-range-from-field-select`).click();
    await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${fromTitle}"`).click();
    if (toTitle) {
      await this.get().getByTestId(`nc-calendar-range-to-field-select`).click();
      await this.rootPage.locator('.ant-select-item-option-content').locator(`:text("${toTitle}")`).click();
    }
  }

  async verifyCalendarRange({ fromTitle, toTitle }: { fromTitle: string; toTitle?: string }) {
    const from = await this.get().getByTestId('nc-calendar-range-from-field-select');

    const fromFieldText = await getTextExcludeIconText(from);
    expect(fromFieldText).toBe(fromTitle);

    if (toTitle) {
      const to = await this.get().getByTestId('nc-calendar-range-to-field-select');
      const toFieldText = await getTextExcludeIconText(to);
      expect(toFieldText).toBe(toTitle);
    }
  }
}
