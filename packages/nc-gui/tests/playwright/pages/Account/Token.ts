import {  Locator } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountTokenPage extends BasePage {
  readonly createBtn: Locator;
  readonly createModal: Locator;
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.createBtn = this.get().locator(`[data-cy="nc-token-create"]`);
    this.createModal = accountPage.rootPage.locator(`.nc-modal-generate-token`);
  }

  async goto() {
    await this.rootPage.goto('/?dummy=users#/account/tokens');
  }

  get() {
    return this.accountPage.get().locator(`[data-cy="nc-token-list"]`);
  }

  async createToken({ description }: { description:string }) {

    await this.createBtn.click();
    await this.createModal.locator(`input[placeholder="Description"]`).fill(description);
    await this.createModal.locator(`[data-cy="nc-token-modal-save"]`).click();
    await this.verifyToast({ message: 'Token generated successfully' });

    // return await this.inviteTeamModal.locator(`.ant-alert-message`).innerText();
  }
  //
  // prefixEmail(email: string) {
  //   const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
  //   return `nc_test_${parallelId}_${email}`;
  // }
  //
  // async closeInvite() {
  //   // two btn-icon-only in invite modal: close & copy url
  //   await this.inviteTeamModal.locator(`button.ant-btn-icon-only:visible`).first().click();
  // }
  //
  // getUserRow({ email: _email }: { email: string }) {
  //   const email = this.prefixEmail(_email);
  //   return this.get().locator(`tr:has-text("${email}")`);
  // }
  //
  // async updateRole({ email: _email, role }: { email: string; role: string }) {
  //   const email = this.prefixEmail(_email);
  //   const userRow = this.getUserRow({ email });
  //   await userRow.locator(`.nc-user-roles`).click();
  //   await this.rootPage.locator(`.nc-role-option:has-text("${role}")`).click();
  //   await this.verifyToast({ message: 'Successfully updated the user details' });
  // }

  /*
    getSharedBaseSubModal() {
      return this.rootPage.locator(`[data-nc="nc-share-base-sub-modal"]`);
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
  */
}
