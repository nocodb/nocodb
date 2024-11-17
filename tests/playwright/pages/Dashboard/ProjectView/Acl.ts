import BasePage from '../../Base';
import { expect } from '@playwright/test';
import { DataSourcePage } from './DataSourcePage';

export class AclPage extends BasePage {
  readonly dataSources: DataSourcePage;

  constructor(dataSources: DataSourcePage) {
    super(dataSources.rootPage);
    this.dataSources = dataSources;
  }

  get() {
    return this.dataSources.getDsDetailsModal();
  }

  async toggle({ table, role }: { table: string; role: string }) {
    await this.get().locator(`.nc-acl-${table}-${role}-chkbox`).click();
  }

  async verify({ table, role, expectedValue }: { table: string; role: string; expectedValue: boolean }) {
    const isChecked = await this.get().locator(`.nc-acl-${table}-${role}-chkbox`).isChecked();
    expect(isChecked).toBe(expectedValue);
  }

  async save() {
    await this.waitForResponse({
      uiAction: async () => await this.get().locator(`button:has-text("Save")`).click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/visibility-rules',
    });
    await this.verifyToast({ message: 'Updated UI ACL for tables successfully' });
  }
}
