import BasePage from '../Base';
import { OrgAdminPage } from './index';

export class Dashboard extends BasePage {
  readonly orgAdminPage: OrgAdminPage;

  constructor(orgAdminPage: OrgAdminPage) {
    super(orgAdminPage.rootPage);
    this.orgAdminPage = orgAdminPage;
  }

  get() {
    return this.rootPage.locator('[data-test-id="nc-admin-dashboard"]');
  }
}
