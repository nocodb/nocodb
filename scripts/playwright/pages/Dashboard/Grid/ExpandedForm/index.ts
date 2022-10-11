// playwright-dev-page.ts
import {  Locator, Page } from '@playwright/test';
import { BasePage } from '../../../Base';

export class ExpandedFormPage {
  readonly page: Page;
  readonly addNewTableButton: Locator;
  readonly base: BasePage;

  constructor(page: Page) {
    this.page = page;
    this.addNewTableButton = page.locator('.nc-add-new-table');
    this.base = new BasePage(page);
  }

  get() {
    return this.page.locator(`.nc-drawer-expanded-form`);
  }

  async fillField({columnTitle, value}: {columnTitle: string, value: string}) {
    const field = this.get().locator(`[pw-data="nc-expand-col-${columnTitle}"]`);
    await field.locator('input').fill(value);
  }
  
  async save() {
    await this.get().locator('button:has-text("Save Row")').click();
    await this.get().press('Escape');
    await this.get().waitFor({state: 'hidden'});
    await this.base.toastWait({message: `updated successfully.`});
    await this.page.locator('[pw-data="grid-load-spinner"]').waitFor({ state: 'hidden' });
  }
}