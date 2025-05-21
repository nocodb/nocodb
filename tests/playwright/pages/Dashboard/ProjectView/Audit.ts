import { expect } from '@playwright/test';
import BasePage from '../../Base';
import { DataSourcePage } from './DataSourcePage';

export class AuditPage extends BasePage {
  constructor(dataSource: DataSourcePage) {
    super(dataSource.rootPage);
  }

  get() {
    return this.rootPage.locator('div.ant-modal-content');
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
    const table = this.get().locator('[data-testid="audit-tab-table"]');
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

  async close() {
    await this.get().click();
    await this.rootPage.keyboard.press('Escape');
  }
}
