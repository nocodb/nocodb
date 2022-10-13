import { DashboardPage } from '..';
import BasePage from '../../Base';
import { AuditSettingsPage } from './Audit';
import { MetaDataPage } from './Metadata';

const tabInfo = {
  'Team & Auth': 'teamAndAuth',
  'App Store': 'appStore',
  'Project Metadata': 'projMetaData',
  'Audit': 'audit',
}


export class SettingsPage extends BasePage {
  private readonly dashboard: DashboardPage;
  readonly audit: AuditSettingsPage;
  readonly metaData: MetaDataPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.audit = new AuditSettingsPage(this);
    this.metaData = new MetaDataPage(this);
  }

  get() {
    return this.rootPage.locator('.nc-modal-settings');
  }

  async selectTab({title}: {title: string}) {
    await this.get().locator(`li[data-menu-id="${tabInfo[title]}"]`).click();
  }

  async close() {
    await this.get().locator('[pw-data="settings-modal-close-button"]').click();
  }
}