// playwright-dev-page.ts
import {  expect } from '@playwright/test';
import { SettingsPage } from '.';

export class AuditSettingsPage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    this.settings = settings;
  }

  async verifyRow(
    {index, opType, opSubtype, description, user, created}: 
    {index: number,opType?: string, opSubtype?: string, description?: string, user?: string, created?: string}
    ) {
    const table = await this.settings.get().locator(`div[data-pw="audit-tab-table"]`);
    const row = table.locator(`tr.ant-table-row`).nth(index);
    
    if(opType) {
      await row.locator(`td.ant-table-cell`).nth(0).textContent()
        .then((text) => expect(text).toContain(opType));
    }

    if(opSubtype) {
      await row.locator(`td.ant-table-cell`).nth(1).textContent()
        .then((text) => expect(text).toContain(opSubtype));
    }

    if(description) {
      await row.locator(`td.ant-table-cell`).nth(2).textContent()
        .then((text) => expect(text).toContain(description));
    }

    if(user) {
      await row.locator(`td.ant-table-cell`).nth(3).textContent()
        .then((text) => expect(text).toContain(user));
    }

    if(created) {
      await row.locator(`td.ant-table-cell`).nth(4).textContent()
        .then((text) => expect(text).toContain(created));
    }
    
  }
}