import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarAddEditStackPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-dropdown-kanban-add-edit-stack-menu`);
  }

  async addOption({ title }: { title: string }) {
    await this.get().locator(`.ant-btn-dashed`).click();
    await this.get().locator(`.nc-select-option >> input`).last().fill(title);
    await this.get().locator(`.nc-select-option >> input`).last().press('Enter');
    await this.verifyToast({ message: 'Column updated' });
  }
}
