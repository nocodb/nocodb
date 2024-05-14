import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarCalendarViewModePage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }
  get() {
    return this.rootPage.getByTestId('nc-calendar-view-mode');
  }

  async changeCalendarView({ title: _title }: { title: string }) {
    await this.get().click();
    await this.rootPage.waitForTimeout(500);

    const title = _title[0].toUpperCase() + _title.slice(1);

    await this.rootPage.locator(`.nc-menu-item-inner`).getByText(title).click({
      force: true,
    });
    await this.rootPage.waitForTimeout(500);
    // await this.get().getByTestId(`nc-calendar-view-mode-${title}`).click();
  }
}
