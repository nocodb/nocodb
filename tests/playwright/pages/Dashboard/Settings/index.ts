import { DashboardPage } from '..';
import BasePage from '../../Base';
import { AuditSettingsPage } from './Audit';
import { MiscSettingsPage } from './Miscellaneous';
import { TeamsPage } from './Teams';
import { DataSourcesPage } from './DataSources';

export enum SettingTab {
  TeamAuth = 'teamAndAuth',
  DataSources = 'dataSources',
  Audit = 'audit',
  ProjectSettings = 'baseSettings',
}

export enum SettingsSubTab {
  ERD = 'erd',
  Miscellaneous = 'misc',
  ACL = 'acl',
}

export class SettingsPage extends BasePage {
  readonly audit: AuditSettingsPage;
  readonly miscellaneous: MiscSettingsPage;
  readonly dataSources: DataSourcesPage;
  readonly teams: TeamsPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.audit = new AuditSettingsPage(this);
    this.miscellaneous = new MiscSettingsPage(this);
    this.dataSources = new DataSourcesPage(this);
    this.teams = new TeamsPage(this);
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

  async toggleNullEmptyFilters() {
    await this.selectTab({ tab: SettingTab.ProjectSettings, subTab: SettingsSubTab.Miscellaneous });
    await this.miscellaneous.clickShowNullEmptyFilters();
    await this.close();
  }
}
