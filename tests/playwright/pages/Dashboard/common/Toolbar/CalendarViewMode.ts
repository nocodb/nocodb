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

  async changeCalendarView({ title }: { title: string }) {
    await this.get().getByTestId(`nc-calendar-view-mode-${title}`).click();
  }
}
