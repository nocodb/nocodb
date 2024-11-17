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

  getViewTab({ title }: { title: string }) {
    return this.get().getByTestId(`nc-calendar-view-mode-${title}`);
  }

  async changeCalendarView({ title }: { title: string }) {
    if (await this.getViewTab({ title }).isVisible()) {
      await this.getViewTab({ title }).click({ force: true });
    } else {
      await this.get().click({ force: true });
      await this.rootPage.waitForTimeout(500);

      await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${title}"`).click();
    }
  }
}
