import { Locator } from '@playwright/test';
import BasePage from '../Base';
import { ChangePasswordPage } from './ChangePassword';
import { AccountPage } from './index';

export class AccountUsersPage extends BasePage {
  readonly inviteUserBtn: Locator;
  readonly inviteUserModal: Locator;
  readonly changePasswordPage: ChangePasswordPage;
  private accountPage: AccountPage;

  constructor(accountPage: AccountPage) {
    super(accountPage.rootPage);
    this.accountPage = accountPage;
    this.inviteUserBtn = this.get().locator(`[data-testid="nc-super-user-invite"]`);
    this.inviteUserModal = accountPage.rootPage.locator(`.nc-modal-invite-user`);
    this.changePasswordPage = new ChangePasswordPage(this.rootPage);
  }

  async goto({ waitForResponse = true }: { waitForResponse?: boolean }) {
    if (waitForResponse) {
      return this.waitForResponse({
        uiAction: async () => await this.rootPage.goto('/#/account/users'),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: `api/v1/users`,
      });
    } else {
      await this.rootPage.waitForTimeout(1000);
      return this.rootPage.goto('/#/account/users');
    }
  }

  async waitUntilContentLoads() {
    return this.rootPage.waitForResponse(resp => resp.url().includes('api/v1/users') && resp.status() === 200);
  }

  get() {
    return this.accountPage.get().locator(`[data-testid="nc-super-user-list"]`);
  }

  async invite({ email, role }: { email: string; role: string }) {
    email = this.prefixEmail(email);

    await this.inviteUserBtn.click();
    await this.inviteUserModal.locator(`input[placeholder="E-mail"]`).fill(email);
    await this.inviteUserModal.locator(`.nc-user-roles`).click();
    const userRoleModal = this.rootPage.locator(`.nc-dropdown-user-role`);
    await userRoleModal.locator(`.nc-role-option:has-text("${role}")`).click();
    const inviteAction = () => this.inviteUserModal.locator(`button:has-text("Invite")`).click();
    await this.waitForResponse({
      uiAction: inviteAction,
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `api/v1/users`,
    });
    await this.verifyToast({ message: 'Successfully added user' });

    // TODO: Wait on the invite api and get the invite url a better way as we are not waiting if the url is reflected in the UI
    // await this.rootPage.waitForTimeout(1000);
    await this.inviteUserModal.waitFor({ state: 'visible' });

    // http://localhost:3000/#/signup/a5e7bf3a-cbb0-46bc-87f7-c2ae21796707
    return (await this.inviteUserModal.locator(`.ant-alert-message`).innerText()).split('\n')[0];
  }

  prefixEmail(email: string) {
    const parallelId = process.env.TEST_PARALLEL_INDEX ?? '0';
    return `nc_test_${parallelId}_${email}`;
  }

  async closeInvite() {
    // two btn-icon-only in invite modal: close & copy url
    await this.inviteUserModal.locator(`button.ant-btn-icon-only:visible`).first().click();
  }

  async getUserRow({ email }: { email: string }) {
    // ensure page is loaded
    email = this.prefixEmail(email);

    const userRow = this.get().locator(`.nc-table-row:has-text("${email}")`).first();

    await userRow.waitFor({ state: 'visible' });

    return userRow.first();
  }

  async updateRole({ email, role }: { email: string; role: string }) {
    const userRow = await this.getUserRow({ email });
    await userRow.locator('.nc-user-roles').click();
    await this.rootPage.locator(`.nc-users-list-role-option:visible:has-text("${role}")`).waitFor();
    await this.rootPage.locator(`.nc-users-list-role-option:visible:has-text("${role}")`).last().click();
    await this.rootPage.locator(`.nc-users-list-role-option`).last().waitFor({ state: 'hidden' });
  }

  async inviteMore() {
    await this.inviteUserModal.locator(`button:has-text("Invite More")`).click();
  }

  async openRowActionMenu({ email }: { email: string }) {
    const userRow = await this.getUserRow({ email });
    return userRow.locator(`.ant-btn`).click();
  }

  async deleteUser({ email }: { email: string }) {
    await this.openRowActionMenu({ email });
    await this.rootPage.locator('.nc-menu-item:visible:has-text("Remove user")').click();
    await this.rootPage.locator('.ant-modal.active button:has-text("Delete User")').click();
    await this.verifyToast({ message: 'User deleted successfully' });
    await this.get().locator(`.nc-table-row:has-text("${email}")`).first().waitFor({ state: 'hidden' });
  }
}
