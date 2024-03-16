import BasePage from '../../../Base';
import { TopbarPage } from '../Topbar';
import { expect, Locator } from '@playwright/test';

export class TopbarSharePage extends BasePage {
  readonly topbar: TopbarPage;

  constructor(topbar: TopbarPage) {
    super(topbar.rootPage);
    this.topbar = topbar;
  }

  get() {
    return this.rootPage.locator(`.nc-modal-share-collaborate`);
  }

  async clickShareProject() {
    await this.get().locator(`[data-testid="docs-share-dlg-share-base"]`).click();
  }

  async switchBaseShareTab({ tab }: { tab: 'public' | 'member' }) {
    await this.get().getByTestId(`nc-base-share-${tab}`).waitFor({ state: 'visible' });
    await this.get().getByTestId(`nc-base-share-${tab}`).click();
  }

  async clickShareViewPublicAccess() {
    await expect(this.get().getByTestId('share-view-toggle')).toHaveCount(1);
    await this.get().getByTestId('share-view-toggle').click();
  }

  async clickCopyLink() {
    await this.get().locator(`[data-testid="docs-share-page-copy-link"]`).click();
  }

  async closeModal() {
    // await this.rootPage.keyboard.press('Escape');
    await this.get().locator('.ant-btn.ant-btn-secondary:has-text("Finish")').click();
  }

  async clickShareViewWithPassword({ password }: { password: string }) {
    await this.get().locator(`[data-testid="share-password-toggle"]`).click();
    await this.get().locator('[data-testid="nc-modal-share-view__password"]').fill(password);
  }

  async clickShareViewWithCSVDownload() {
    await this.get().locator(`[data-testid="share-download-toggle"]`).click();
  }

  async clickShareBase() {
    await this.get().waitFor();
    const shareBase = this.get().getByTestId('nc-share-base-tab');

    if (await shareBase.isVisible()) {
      await shareBase.click();
    }
  }

  async clickShareView() {
    await this.get().waitFor();

    const shareView = this.get().getByTestId('nc-share-view-tab');

    if (await shareView.isVisible()) {
      await shareView.click();
    }
  }

  async clickShareBasePublicAccess() {
    await this.get()
      .locator(`[data-testid="nc-share-base-sub-modal"]`)
      .locator('.ant-switch')
      .nth(0)
      .click({
        position: { x: 4, y: 4 },
      });
  }

  async isSharedBasePublicAccessEnabled() {
    return await this.get()
      .locator(`[data-testid="nc-share-base-sub-modal"]`)
      .locator('.ant-switch')
      .nth(0)
      .isChecked();
  }

  async clickShareBaseEditorAccess() {
    await this.rootPage.waitForTimeout(1000);

    await this.switchBaseShareTab({ tab: 'public' });

    const shareBaseSwitch = this.get().locator(`[data-testid="nc-share-base-sub-modal"]`).locator('.ant-switch');
    const count = await shareBaseSwitch.count();

    await this.get()
      .locator(`[data-testid="nc-share-base-sub-modal"]`)
      .locator('.ant-switch')
      .nth(count - 1)
      .click({
        position: { x: 4, y: 4 },
      });
  }

  async isSharedBaseEditorAccessEnabled() {
    return await this.get()
      .locator(`[data-testid="nc-share-base-sub-modal"]`)
      .locator('.ant-switch')
      .nth(0)
      .isChecked();
  }

  async clickShareViewSurveyMode() {
    await this.get().locator(`[data-testid="nc-modal-share-view__surveyMode"]`).click();
  }

  async invite({ email, role }: { email: string; role: string }) {
    const emailField: Locator = this.get().locator('[data-testid="docs-share-dlg-share-base-collaborate-emails"]');
    await emailField.fill(email);

    if (role === 'editor') {
      const roleField: Locator = this.get().locator('[data-testid="docs-share-dlg-share-base-collaborate-role"]');
      await roleField.click();

      const roleOptionsMenu: Locator = this.rootPage.locator('.ant-select-dropdown.nc-dropdown-user-role');
      console.log(await roleOptionsMenu.locator(`.nc-role-option`).count());
      await roleOptionsMenu
        .locator(`.nc-role-option`)
        .nth(role === 'editor' ? 0 : 1)
        .click();
    }

    await this.get().locator('[data-testid="docs-share-btn"]').click();
  }

  async getInvitationUrl() {
    await this.get().locator('[data-testid="docs-share-invitation-copy"]').click();
    const url = await this.get().locator('[data-invite-link="data-invite-link"]').innerText();
    await this.rootPage.keyboard.press('Escape');

    // TODO: fix this; text wasn't copied to clipboard
    // return await this.getClipboardText();
    return url;
  }
}
