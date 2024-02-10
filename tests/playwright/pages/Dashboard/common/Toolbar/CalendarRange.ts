import BasePage from '../../../Base';
import { ToolbarPage } from './index';

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
    await this.get().getByTestId(`nc-calendar-range-from-field-selec`).click();
    await this.rootPage.locator('.ant-picker-cell-in-view').locator(`:text("${fromTitle}")`).click();
    if (toTitle) {
      await this.get().getByTestId(`nc-calendar-range-to-field-select`).click();
      await this.rootPage.locator('.ant-picker-cell-in-view').locator(`:text("${toTitle}")`).click();
    }
  }
}
