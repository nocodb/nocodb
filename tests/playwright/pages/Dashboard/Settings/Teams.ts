import { Locator } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';

export class TeamsPage extends BasePage {
  private readonly settings: SettingsPage;
  private readonly inviteTeamBtn: Locator;
  private readonly inviteTeamModal: Locator;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
    this.inviteTeamBtn = this.get().locator(`button:has-text("Invite Team")`);
    this.inviteTeamModal = this.rootPage.locator('.nc-modal-share-collaborate');
  }

  get() {
    return this.settings.get().getByTestId('nc-settings-subtab-Users Management');
  }

  // Prefixing to differentiate between emails created by the tests which are deleted after the test run
  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  getSharedBaseSubModal() {
    return this.rootPage.getByTestId('nc-share-base-sub-modal');
  }

  async clickInviteTeamBtn() {
    await this.inviteTeamBtn.click();
  }

  // will be obsolete once we have hub deployed
  async invite({ email, role, skipOpeningModal }: { email: string; role: string; skipOpeningModal?: boolean }) {
    email = this.prefixEmail(email);

    await this.inviteTeamModal.getByTestId('docs-share-dlg-share-base-collaborate-emails').fill(email);
    await this.inviteTeamModal.getByTestId('nc-share-invite-user-role-option-viewer').click();
    const dropdown = this.rootPage.locator('.nc-dropdown-user-role');
    await dropdown.locator(`.nc-role-option:has-text("${role}")`).click();
    await this.inviteTeamModal.getByTestId('docs-share-btn').click();
    await this.inviteTeamModal.getByTestId('docs-share-invitation-copy').waitFor({ state: 'visible', timeout: 2000 });

    await this.rootPage.waitForTimeout(1000);
    await this.inviteTeamModal.getByTestId('docs-share-invitation-copy').click();
    await this.rootPage.waitForTimeout(1000);
    await this.inviteTeamModal
      .locator('[data-testid="docs-share-invitation-copy"]:has-text(" Copied invite link ")')
      .waitFor({ state: 'visible', timeout: 2000 });
    await this.rootPage.keyboard.press('Escape');
    return await this.getClipboardText();
  }

  async closeInvite() {
    // todo: Fix the case where there is ghost dom for previous modal
    await this.inviteTeamModal.getByTestId('invite-user-and-share-base-modal-close-btn').last().click();
  }

  async inviteMore() {
    await this.inviteTeamModal.locator(`button:has-text("Invite More")`).click();
  }

  async toggleSharedBase({ toggle }: { toggle: boolean }) {
    const toggleBtn = this.getSharedBaseSubModal().locator(`.nc-disable-shared-base`);
    const toggleBtnText = await toggleBtn.first().innerText();

    const disabledBase = toggleBtnText.includes('Disable');

    if (disabledBase) {
      if (toggle) {
        // if share base was disabled && request was to enable
        await toggleBtn.click();
        const modal = this.rootPage.locator(`.nc-dropdown-shared-base-toggle`);
        await modal.locator(`.ant-dropdown-menu-title-content`).click();
      }
    } else {
      if (!toggle) {
        // if share base was enabled && request was to disable
        await toggleBtn.click();
        const modal = this.rootPage.locator(`.nc-dropdown-shared-base-toggle`);
        await modal.locator(`.ant-dropdown-menu-title-content`).click();
      }
    }
  }

  async getSharedBaseUrl() {
    return await this.getSharedBaseSubModal().locator(`.nc-url:visible`).textContent();
  }

  async getInvitationUrl() {
    return await this.rootPage.getByTestId('invite-modal-invitation-url').textContent();
  }

  async sharedBaseActions({ action }: { action: string }) {
    const actionMenu = ['reload', 'copy url', 'open tab', 'copy embed code'];
    const index = actionMenu.indexOf(action);

    await this.getSharedBaseSubModal().locator(`button.ant-btn-icon-only`).nth(index).click();
  }

  async sharedBaseRole({ role }: { role: string }) {
    // editor | viewer
    // await this.getSharedBaseSubModal()
    //   .locator(`.nc-shared-base-role`)
    //   .waitFor();
    await this.getSharedBaseSubModal().locator(`.nc-shared-base-role:visible`).click();
    const userRoleModal = this.rootPage.locator(`.nc-dropdown-share-base-role:visible`);
    await userRoleModal.locator(`.ant-select-item-option-content:has-text("${role}"):visible`).click();
  }
}
