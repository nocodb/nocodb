import { Page } from '@playwright/test';
import BasePage from '../Base';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get() {
    return this.rootPage.locator('body');
  }
}
