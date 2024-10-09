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

    await this.rootPage.waitForTimeout(200);
  }

  async verifySuccessMessage() {
    await this.rootPage.locator('.nc-shared-form-success-msg').waitFor({ state: 'visible', timeout: 10000 });
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
    // await this.get().locator('.nc-close-btn').click();
    await this.rootPage.keyboard.press('Escape');
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
    await this.get()
      .locator(`.ant-card:has-text("${cardTitle}"):visible`)
      .locator('.nc-list-item-link-unlink-btn')
      .click();
  }

  fieldLabel({ title }: { title: string }) {
    return this.get()
      .getByTestId(`nc-shared-form-item-${title.replace(' ', '')}`)
      .locator('.nc-form-column-label');
  }

  async getFormFieldErrors({ title }: { title: string }) {
    const field = this.get().getByTestId(`nc-shared-form-item-${title.replace(' ', '')}`);
    await field.scrollIntoViewIfNeeded();
    const fieldErrorEl = field.locator('.ant-form-item-explain');
    return {
      locator: fieldErrorEl,
      verify: async ({ hasError, hasErrorMsg }: { hasError?: boolean; hasErrorMsg?: string | RegExp }) => {
        if (hasError !== undefined) {
          if (hasError) {
            await fieldErrorEl.waitFor({ state: 'visible' });

            await expect(fieldErrorEl).toBeVisible();
          } else {
            await expect(fieldErrorEl).not.toBeVisible();
          }
        }

        if (hasErrorMsg !== undefined) {
          await fieldErrorEl.waitFor({ state: 'visible' });

          await expect(fieldErrorEl.locator('> div').filter({ hasText: hasErrorMsg }).first()).toHaveText(hasErrorMsg);
        }
      },
    };
  }

  async verifyField({ title, isVisible }: { title: string; isVisible: boolean }) {
    const field = this.fieldLabel({ title });

    if (isVisible) {
      await expect(field).toBeVisible();
    } else {
      await expect(field).not.toBeVisible();
    }
  }
}
