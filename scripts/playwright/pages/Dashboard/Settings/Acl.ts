import { Locator, expect } from "@playwright/test";
import { SettingsPage } from ".";
import BasePage from "../../Base";

export class AclPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings
      .get()
      .locator(`[pw-data="nc-settings-subtab-UI Access Control"]`);
  }

  async toggle({ table, role }: { table: string; role: string }) {
    await this.get().locator(`.nc-acl-${table}-${role}-chkbox`).click();
  }

  async save() {
    this.get().locator(`button:has-text("Save")`).click();
    await this.toastWait({ message: "Updated UI ACL for tables successfully" });
  }
}
