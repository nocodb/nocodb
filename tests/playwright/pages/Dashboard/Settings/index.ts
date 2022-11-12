import { DashboardPage } from '..';
import BasePage from '../../Base';
import { AuditSettingsPage } from './Audit';
import { SettingsErdPage } from './Erd';
import { MetaDataPage } from './Metadata';
import { AppStoreSettingsPage } from './AppStore';
import { MiscSettingsPage } from './Miscellaneous';
import { TeamsPage } from './Teams';
import { AclPage } from './Acl';

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

export class SettingsPage extends BasePage {
  private readonly dashboard: DashboardPage;
  readonly audit: AuditSettingsPage;
  readonly appStore: AppStoreSettingsPage;
  readonly metaData: MetaDataPage;
  readonly miscellaneous: MiscSettingsPage;
  readonly erd: SettingsErdPage;
  readonly teams: TeamsPage;
  readonly acl: AclPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.audit = new AuditSettingsPage(this);
    this.appStore = new AppStoreSettingsPage(this);
    this.metaData = new MetaDataPage(this);
    this.miscellaneous = new MiscSettingsPage(this);
    this.erd = new SettingsErdPage(this);
    this.teams = new TeamsPage(this);
    this.acl = new AclPage(this);
  }

  get() {
    return this.rootPage.locator('.nc-modal-settings');
  }

  async selectTab({ tab, subTab }: { tab: SettingTab; subTab?: SettingsSubTab }) {
    await this.get().locator(`li[data-menu-id="${tab}"]`).click();
    if (subTab) await this.get().locator(`li[data-menu-id="${subTab}"]`).click();
  }

  async selectSubTab({ subTab }: { subTab: SettingsSubTab }) {
    await this.get().locator(`li[data-menu-id="${subTab}"]`).click();
  }

  async close() {
    await this.get().locator('[data-testid="settings-modal-close-button"]').click();
    await this.get().waitFor({ state: 'hidden' });
  }
}
