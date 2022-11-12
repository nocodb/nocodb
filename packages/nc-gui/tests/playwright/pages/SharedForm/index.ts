import { expect, Page } from '@playwright/test';
import BasePage from '../Base';
import { CellPageObject } from '../Dashboard/common/Cell';

export class SharedFormPage extends BasePage {
  readonly cell: CellPageObject;

  constructor(rootPage: Page) {
    super(rootPage);
    this.cell = new CellPageObject(this);
  }

  get() {
    return this.rootPage.locator('html');
  }

  async submit() {
    await this.waitForResponse({
      uiAction: this.get().locator('[data-testid="shared-form-submit-button"]').click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/rows',
    });
  }

  async verifySuccessMessage() {
    await expect(
      await this.get().locator('.ant-alert-success', {
        hasText: 'Successfully submitted form data',
      })
    ).toBeVisible();
  }
}
