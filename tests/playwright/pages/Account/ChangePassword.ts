import { expect, Page } from '@playwright/test';
import BasePage from '../Base';

export class ChangePasswordPage extends BasePage {
  constructor(rootPage: Page) {
    super(rootPage);
  }

  get() {
    return this.rootPage.getByTestId('nc-user-settings-form');
  }

  async changePassword({
    oldPass,
    newPass,
    repeatPass,
    networkValidation,
  }: {
    oldPass: string;
    newPass: string;
    repeatPass: string;
    networkValidation?: boolean;
  }) {
    const currentPassword = this.get().locator('input[data-testid="nc-user-settings-form__current-password"]');
    const newPassword = this.get().locator('input[data-testid="nc-user-settings-form__new-password"]');
    const confirmPassword = this.get().locator('input[data-testid="nc-user-settings-form__new-password-repeat"]');

    await currentPassword.waitFor({ state: 'visible' });
    await newPassword.waitFor({ state: 'visible' });
    await confirmPassword.waitFor({ state: 'visible' });

    // in-spite of the waitFor above, the input fields are not always ready to be filled
    // this is a workaround
    await this.rootPage.waitForTimeout(500);

    await currentPassword.fill(oldPass);
    await newPassword.fill(newPass);
    await confirmPassword.fill(repeatPass);

    const submitChangePassword = () =>
      this.get().locator('button[data-testid="nc-user-settings-form__submit"]').click();
    if (networkValidation) {
      await this.waitForResponse({
        uiAction: submitChangePassword,
        httpMethodsToMatch: ['POST'],
        requestUrlPathToMatch: 'api/v1/db/auth/password/change',
      });
    } else {
      await submitChangePassword();
    }
  }

  async verifyFormError({ error }: { error: string }) {
    await expect(this.get().getByTestId('nc-user-settings-form__error')).toHaveText(error);
  }

  async verifyPasswordDontMatchError() {
    await expect(this.rootPage.locator('.ant-form-item-explain-error')).toHaveText('Passwords do not match');
  }
}
