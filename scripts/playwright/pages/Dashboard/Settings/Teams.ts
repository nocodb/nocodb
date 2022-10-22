import { Locator, expect } from "@playwright/test";
import { SettingsPage } from ".";
import BasePage from "../../Base";
import { writeFileAsync } from "xlsx";
import { ToolbarPage } from "../common/Toolbar";

export class TeamsPage extends BasePage {
  private readonly settings: SettingsPage;
  readonly inviteTeamBtn: Locator;
  readonly inviteTeamModal: Locator;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
    this.inviteTeamBtn = this.get().locator(`button:has-text("Invite Team")`);
    this.inviteTeamModal = this.rootPage.locator(
      `.nc-modal-invite-user-and-share-base`
    );
  }

  get() {
    return this.settings
      .get()
      .locator(`[pw-data="nc-settings-subtab-Users Management"]`);
  }

  async invite({ email, role }: { email: string; role: string }) {
    await this.inviteTeamBtn.click();
    await this.inviteTeamModal
      .locator(`input[placeholder="E-mail"]`)
      .fill(email);
    await this.inviteTeamModal.locator(`.nc-user-roles`).click();
    const userRoleModal = this.rootPage.locator(`.nc-dropdown-user-role`);
    await userRoleModal.locator(`.nc-role-option:has-text("${role}")`).click();
    await this.inviteTeamModal.locator(`button:has-text("Invite")`).click();
    await this.toastWait({ message: "Successfully updated the user details" });

    return await this.inviteTeamModal.locator(`.ant-alert-message`).innerText();
  }

  async closeInvite() {
    // two btn-icon-only in invite modal: close & copy url
    await this.inviteTeamModal
      .locator(`button.ant-btn-icon-only`)
      .first()
      .click();
  }

  async inviteMore() {
    await this.inviteTeamModal
      .locator(`button:has-text("Invite More")`)
      .click();
  }
}
