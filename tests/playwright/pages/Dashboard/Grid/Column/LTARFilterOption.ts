import { ToolbarPage } from './index';
import { ToolbarFilterPage } from '../../common/Toolbar/Filter';
import BasePage from '../../../Base';

export class LTARFilterPage extends ToolbarFilterPage {
  constructor(rootPage) {
    super({ rootPage });
  }

  get() {
    return this.rootPage.getByTestId(`nc-filter`);
  }
}
