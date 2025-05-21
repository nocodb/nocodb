import { ToolbarActionsPage } from '.';
import { ErdBasePage } from '../../../commonBase/Erd';

export class ToolbarActionsErdPage extends ErdBasePage {
  readonly toolbarActions: ToolbarActionsPage;

  constructor(toolbarActions: ToolbarActionsPage) {
    super(toolbarActions.rootPage);
    this.toolbarActions = toolbarActions;
  }

  get() {
    return this.rootPage.locator(`.erd-single-table-modal`);
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }
}
