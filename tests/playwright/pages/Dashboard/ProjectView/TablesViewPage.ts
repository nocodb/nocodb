import BasePage from '../../Base';
import { ProjectViewPage } from './index';

export class TablesViewPage extends BasePage {
  readonly projectView: ProjectViewPage;

  constructor(projectView: ProjectViewPage) {
    super(projectView.rootPage);
    this.projectView = projectView;
  }

  get() {
    return this.rootPage.locator('.nc-all-tables-view');
  }
}
