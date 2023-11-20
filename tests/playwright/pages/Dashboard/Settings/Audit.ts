import { expect } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';

export class AuditSettingsPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[data-testid="nc-settings-subtab-Audit"]`);
  }

  async verifyRow({
    index,
    opType,
    opSubtype,
    description,
    user,
    created,
  }: {
    index: number;
    opType?: string;
    opSubtype?: string;
    description?: string;
    user?: string;
    created?: string;
  }) {
    const table = this.get();
    const row = table.locator(`tr.ant-table-row`).nth(index);

    if (opType) {
      await row
        .locator(`td.ant-table-cell`)
        .nth(0)
        .textContent()
        .then(async text => expect(text).toContain(opType));
    }

    if (opSubtype) {
      await row
        .locator(`td.ant-table-cell`)
        .nth(1)
        .textContent()
        .then(async text => expect(text).toContain(opSubtype));
    }

    if (description) {
      await row
        .locator(`td.ant-table-cell`)
        .nth(2)
        .textContent()
        .then(async text => expect(text).toContain(description));
    }

    if (user) {
      await row
        .locator(`td.ant-table-cell`)
        .nth(3)
        .textContent()
        .then(async text => expect(text).toContain(user));
    }

    if (created) {
      await row
        .locator(`td.ant-table-cell`)
        .nth(4)
        .textContent()
        .then(async text => expect(text).toContain(created));
    }
  }
}
