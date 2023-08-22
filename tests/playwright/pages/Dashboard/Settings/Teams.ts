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
    this.inviteTeamModal = this.rootPage.getByTestId('invite-user-and-share-base-modal');
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

  async invite({ email, role, skipOpeningModal }: { email: string; role: string; skipOpeningModal?: boolean }) {
    email = this.prefixEmail(email);

    if (!skipOpeningModal) await this.inviteTeamBtn.click();

    await this.inviteTeamModal.locator(`input[placeholder="E-mail"]`).fill(email);
    await this.inviteTeamModal.locator(`.nc-user-roles`).click();
    const userRoleModal = this.rootPage.locator(`.nc-dropdown-user-role`);
    await userRoleModal.locator(`.nc-role-option:has-text("${role}")`).click();
    await this.inviteTeamModal.locator(`button:has-text("Invite")`).click();
    await this.verifyToast({ message: 'Successfully updated the user details' });

    // http://localhost:3000/#/signup/a5e7bf3a-cbb0-46bc-87f7-c2ae21796707
    return (await this.inviteTeamModal.locator(`.ant-alert-message`).innerText()).slice(0, 67);
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
        const modal = await this.rootPage.locator(`.nc-dropdown-shared-base-toggle`);
        await modal.locator(`.ant-dropdown-menu-title-content`).click();
      }
    } else {
      if (!toggle) {
        // if share base was enabled && request was to disable
        await toggleBtn.click();
        const modal = await this.rootPage.locator(`.nc-dropdown-shared-base-toggle`);
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
    const userRoleModal = await this.rootPage.locator(`.nc-dropdown-share-base-role:visible`);
    await userRoleModal.locator(`.ant-select-item-option-content:has-text("${role}"):visible`).click();
  }
}
