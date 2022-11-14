import { Locator } from '@playwright/test';
import BasePage from '../Base';
import { AccountPage } from './index';

export class AccountUsersPage extends BasePage {
  readonly inviteUserBtn: Locator;
  readonly inviteUserModal: Locator;
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.inviteUserBtn = this.get().locator(`[data-testid="nc-super-user-invite"]`);
    this.inviteUserModal = accountPage.rootPage.locator(`.nc-modal-invite-user`);
  }

  async goto() {
    await this.rootPage.goto('/#/account/users/list', { waitUntil: 'networkidle' });
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-super-user-list"]`);
  }

  async invite({ email: _email, role }: { email: string; role: string }) {
    const email = this.prefixEmail(_email);

    await this.inviteUserBtn.click();
    await this.inviteUserModal.locator(`input[placeholder="E-mail"]`).fill(email);
    await this.inviteUserModal.locator(`.nc-user-roles`).click();
    const userRoleModal = this.rootPage.locator(`.nc-dropdown-user-role`);
    await userRoleModal.locator(`.nc-role-option:has-text("${role}")`).click();
    await this.inviteUserModal.locator(`button:has-text("Invite")`).click();
    await this.verifyToast({ message: 'Successfully added user' });

    return await this.inviteUserModal.locator(`.ant-alert-message`).innerText();
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  async closeInvite() {
    // two btn-icon-only in invite modal: close & copy url
    await this.inviteUserModal.locator(`button.ant-btn-icon-only:visible`).first().click();
  }

  getUserRow({ email: _email }: { email: string }) {
    const email = this.prefixEmail(_email);
    return this.get().locator(`tr:has-text("${email}")`);
  }

  async updateRole({ email, role }: { email: string; role: string }) {
    const userRow = this.getUserRow({ email });

    await userRow.locator(`.nc-user-roles`).click();

    // todo: replace delay with waitForSelector
    await new Promise(resolve => setTimeout(resolve, 400));

    await this.rootPage.locator(`.nc-users-list-role-option:visible:has-text("${role}")`).click();
    await this.verifyToast({ message: 'Successfully updated the user details' });
  }

  async inviteMore() {
    await this.inviteUserModal.locator(`button:has-text("Invite More")`).click();
  }

  async openRowActionMenu({ email }: { email: string }) {
    const userRow = this.getUserRow({ email });
    return userRow.locator(`.nc-user-row-action`).click();
  }

  async deleteUser({ email }: { email: string }) {
    await this.openRowActionMenu({ email });
    await this.rootPage.locator('[data-testid="nc-super-user-delete"]:visible').click();
    await this.rootPage.locator('.ant-modal-confirm-confirm button:has-text("Ok")').click();
    await this.verifyToast({ message: 'User deleted successfully' });
  }
}
