import { expect, Locator } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';
import { writeFileAsync } from 'xlsx';
import { ToolbarPage } from '../common/Toolbar';

export class TeamsPage extends BasePage {
  private readonly settings: SettingsPage;
  readonly inviteTeamBtn: Locator;
  readonly inviteTeamModal: Locator;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
    this.inviteTeamBtn = this.get().locator(`button:has-text("Invite Team")`);
    this.inviteTeamModal = this.rootPage.locator(`.nc-modal-invite-user-and-share-base`);
  }

  get() {
    return this.settings.get().locator(`[data-testid="nc-settings-subtab-Users Management"]`);
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  getSharedBaseSubModal() {
    return this.rootPage.locator(`[data-testid="nc-share-base-sub-modal"]`);
  }

  async invite({ email, role }: { email: string; role: string }) {
    email = this.prefixEmail(email);

    await this.inviteTeamBtn.click();
    await this.inviteTeamModal.locator(`input[placeholder="E-mail"]`).fill(email);
    await this.inviteTeamModal.locator(`.nc-user-roles`).click();
    const userRoleModal = this.rootPage.locator(`.nc-dropdown-user-role`);
    await userRoleModal.locator(`.nc-role-option:has-text("${role}")`).click();
    await this.inviteTeamModal.locator(`button:has-text("Invite")`).click();
    await this.verifyToast({ message: 'Successfully updated the user details' });

    return await this.inviteTeamModal.locator(`.ant-alert-message`).innerText();
  }

  async closeInvite() {
    // two btn-icon-only in invite modal: close & copy url
    await this.inviteTeamModal.locator(`button.ant-btn-icon-only:visible`).first().click();
  }

  async inviteMore() {
    await this.inviteTeamModal.locator(`button:has-text("Invite More")`).click();
  }

  async toggleSharedBase({ toggle }: { toggle: boolean }) {
    const toggleBtn = await this.getSharedBaseSubModal().locator(`.nc-disable-shared-base`);
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
    const url = await this.getSharedBaseSubModal().locator(`.nc-url:visible`).innerText();
    return url;
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
