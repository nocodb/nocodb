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
      uiAction: async () => await this.get().getByTestId('shared-form-submit-button').first().click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/rows',
    });
  }

  async verifySuccessMessage() {
    await expect(
      this.get().locator('.ant-alert-success', {
        hasText: 'Successfully submitted form data',
      })
    ).toBeVisible();
  }

  async clickLinkToChildList() {
    await this.get().locator('.nc-virtual-cell').hover();
    await this.get().locator('.nc-action-icon').click({ force: true });
    //await this.get().locator('button[data-testid="nc-child-list-button-link-to"]').click();
  }

  async closeLinkToChildList() {
    await this.get().locator('.nc-close-btn').click();
  }

  async verifyChildList(cardTitle?: string[]) {
    await this.get().locator('.nc-modal-link-record').waitFor();
    const linkRecord = this.get();

    // DOM element validation
    //    title: Link Record
    //    button: Add new record
    //    icon: reload
    //await expect(this.get().locator(`.ant-modal-title`)).toHaveText(`Link record`);

    // add new record option is not available for shared form
    expect(await linkRecord.locator(`button:has-text("Link more records")`).isVisible()).toBeFalsy();

    // placeholder: Filter query
    expect(await linkRecord.locator('.nc-excluded-search').isVisible()).toBeTruthy();

    {
      const childList = linkRecord.locator(`.ant-card`);
      await expect.poll(() => linkRecord.locator(`.ant-card`).count()).toBe(cardTitle.length);
      for (let i = 0; i < cardTitle.length; i++) {
        expect(await childList.nth(i).textContent()).toContain(cardTitle[i]);
      }
    }
  }

  async selectChildList(cardTitle: string) {
    await this.get().locator(`.ant-card:has-text("${cardTitle}"):visible`).click();
  }
}
