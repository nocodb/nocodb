import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { Locator } from '@playwright/test';

export class ToolbarSharePage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-modal-share-collaborate`).locator('.ant-modal-content');
  }

  async clickShareView() {
    await this.get().locator(`[data-testid="docs-share-dlg-share-view"]`).click();
  }

  async clickShareProject() {
    await this.get().locator(`[data-testid="docs-share-dlg-share-project"]`).click();
  }

  async clickShareViewPublicAccess() {
    await this.get().locator(`[data-testid="share-view-toggle"]`).click();
  }

  async clickCopyLink() {
    await this.get().locator(`[data-testid="docs-share-page-copy-link"]`).click();
  }

  async closeModal() {
    await this.rootPage.keyboard.press('Escape');
  }

  async clickShareViewWithPassword({ password }: { password: string }) {
    await this.get().locator(`[data-testid="share-password-toggle"]`).click();
    await this.get().locator('data-testid="nc-modal-share-view__password"]').fill(password);
  }

  async clickShareViewWithCSVDownload() {
    await this.get().locator(`[data-testid="share-download-toggle"]`).click();
  }

  async clickShareBase() {
    await this.get().locator(`[data-testid="db-share-base"]`).click();
  }

  async clickShareBasePublicAccess() {
    await this.get().locator(`[data-testid="nc-share-base-sub-modal"]`).locator('.ant-switch').nth(0).click();
  }

  async clickShareBaseEditorAccess() {
    await this.get().locator(`[data-testid="nc-share-base-sub-modal"]`).locator('.ant-switch').nth(1).click();
  }

  async clickShareViewSurveyMode() {
    await this.get().locator(`[data-testid="nc-modal-share-view__surveyMode"]`).click();
  }

  async invite({ email, role }: { email: string; role: string }) {
    const emailField: Locator = this.get().locator('[data-testid="docs-share-dlg-share-project-collaborate-emails"]');
    await emailField.fill(email);

    if (role === 'editor') {
      const roleField: Locator = this.get().locator('[data-testid="docs-share-dlg-share-project-collaborate-role"]');
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
    await this.rootPage.keyboard.press('Escape');
    return await this.getClipboardText();
  }
}
