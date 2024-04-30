import BasePage from '../Base';
import { OrgAdminPage } from './index';

export class Domain extends BasePage {
  readonly orgAdminPage: OrgAdminPage;

  constructor(orgAdminPage: OrgAdminPage) {
    super(orgAdminPage.rootPage);
    this.orgAdminPage = OrgAdminPage;
  }

  get() {
    return this.rootPage.locator('[data-test-id="nc-org-domain"]');
  }

  async addDomain(domainName: string) {
    await this.get().locator('[data-test-id="nc-org-domain-add"]').click();
    await this.rootPage.locator('[data-test-id="nc-org-domain-name"]').fill(domainName);

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('[data-test-id="nc-org-domain-save"]').click(),
      httpMethodsToMatch: ['PATCH', 'POST'],
      requestUrlPathToMatch: '/api/v2/org-domain',
    });
  }

  async verifyDomain(domainName: string) {
    await this.get().locator('[data-test-id="nc-org-domain-add"]').click();
    await this.rootPage.locator('[data-test-id="nc-org-domain-name"]').fill(domainName);

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('[data-test-id="nc-org-domain-save"]').click(),
      httpMethodsToMatch: ['PATCH', 'POST'],
      requestUrlPathToMatch: '/api/v2/org-domain',
    });
  }

  async deleteDomain(domainName: string) {
    await this.get().locator('[data-test-id="nc-org-domain-add"]').click();
    await this.rootPage.locator('[data-test-id="nc-org-domain-name"]').fill(domainName);

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('[data-test-id="nc-org-domain-save"]').click(),
      httpMethodsToMatch: ['PATCH', 'POST'],
      requestUrlPathToMatch: '/api/v2/org-domain',
    });
  }
}
