import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarStackbyPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-dropdown-kanban-stacked-by-menu`);
  }

  async click({ title }: { title: string }) {
    await this.get().locator(`.nc-kanban-grouping-field-select`).click();
    await this.rootPage.locator('.ant-select-dropdown:visible').locator(`div[title="${title}"]`).click();
  }
}
