import { Page } from '@playwright/test'
import BasePage from '../Base';

export enum SettingTab {
  TeamAuth = 'teamAndAuth',
  AppStore = 'appStore',
  ProjectMetadata = 'projMetaData',
  Audit = 'audit',
}

export enum SettingsSubTab {
  ERD = 'erd',
  Miscellaneous = 'misc',
  ACL = 'acl',
}

export class AccountPage extends BasePage {
  // private readonly dashboard: DashboardPage;
  // readonly audit: AuditSettingsPage;
  // readonly appStore: AppStoreSettingsPage;
  // readonly metaData: MetaDataPage;
  // readonly miscellaneous: MiscSettingsPage;
  // readonly erd: SettingsErdPage;
  // readonly teams: TeamsPage;
  // readonly acl: AclPage;

  constructor(page: Page) {
    super(page);
  }

  get() {
    return this.rootPage.locator('body');
  }

  // async selectTab({ tab, subTab }: { tab: SettingTab; subTab?: SettingsSubTab }) {
  //   await this.get().locator(`li[data-menu-id="${tab}"]`).click();
  //   if (subTab) await this.get().locator(`li[data-menu-id="${subTab}"]`).click();
  // }
  //
  // async selectSubTab({ subTab }: { subTab: SettingsSubTab }) {
  //   await this.get().locator(`li[data-menu-id="${subTab}"]`).click();
  // }
  //
  // async close() {
  //   await this.get().locator('[data-nc="settings-modal-close-button"]').click();
  //   await this.get().waitFor({ state: 'hidden' });
  // }
}
