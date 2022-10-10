// playwright-dev-page.ts
import {  Locator, Page, expect } from '@playwright/test';
import { BasePage } from '../Base';
import { CellPageObject } from '../Cell';
import { ColumnPageObject } from '../Column';

export class ExpandedFormPage {
  readonly page: Page;
  readonly addNewTableButton: Locator;
  readonly column: ColumnPageObject;
  readonly cell: CellPageObject;
  readonly base: BasePage;

  constructor(page: Page) {
    this.page = page;
    this.addNewTableButton = page.locator('.nc-add-new-table');
    this.column = new ColumnPageObject(page);
    this.cell = new CellPageObject(page);
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
    await this.page.waitForTimeout(400);
  }
}