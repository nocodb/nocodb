import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { DataSourcePage } from './DataSourcePage';
import { TablesViewPage } from './TablesViewPage';
import { AccessSettingsPage } from './AccessSettingsPage';
import { BaseSettingsPage } from './Settings';

export class ProjectViewPage extends BasePage {
  readonly dashboard: DashboardPage;

  // sub components
  readonly dataSources: DataSourcePage;
  readonly tables: TablesViewPage;
  readonly accessSettings: AccessSettingsPage;
  readonly settings: BaseSettingsPage;

  // assets

  readonly sidebar_overview_btn: Locator;
  readonly tab_overview: Locator;
  readonly tab_dataSources: Locator;
  readonly tab_accessSettings: Locator;

  readonly btn_addNewTable: Locator;
  readonly btn_importData: Locator;
  readonly btn_addNewDataSource: Locator;
  readonly btn_share: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;

    this.tables = new TablesViewPage(this);
    this.dataSources = new DataSourcePage(this);
    this.accessSettings = new AccessSettingsPage(this);
    this.settings = new BaseSettingsPage(this);

    this.sidebar_overview_btn = this.dashboard.leftSidebar
      .get()
      .locator('[data-testid="nc-sidebar-base-overview-btn"]');

    this.tab_overview = this.get().locator('[data-testid="proj-view-tab__overview"]');
    this.tab_dataSources = this.get().locator('[data-testid="proj-view-tab__data-sources"]');
    this.tab_accessSettings = this.get().locator('[data-testid="proj-view-tab__access-settings"]');

    this.btn_addNewTable = this.get().locator('[data-testid="proj-view-btn__add-new-table"]');
    this.btn_importData = this.get().locator('[data-testid="proj-view-btn__import-data"]');
    this.btn_addNewDataSource = this.get().locator('.nc-btn-new-datasource');
    this.btn_share = this.get().locator('[data-testid="share-base-button"]');
  }

  get() {
    return this.dashboard.get().locator('.nc-base-view-tab');
  }

  async openOverview() {
    if (await this.get().isVisible()) return;

    await this.sidebar_overview_btn.scrollIntoViewIfNeeded();

    await this.sidebar_overview_btn.click();

    await this.get().waitFor({ state: 'visible' });
  }

  async verifyAccess(role: string) {
    // Let any in-flight navigation (e.g. auto-redirect to first table for users
    // without projectOverviewTab permission) settle before clicking around.
    await this.rootPage.waitForLoadState('networkidle').catch(() => {});

    await this.dashboard.leftSidebar.sidebarNav.navigateToSettingsPage('collaborator');

    // Wait for the settings navigation to settle. We can't rely on
    // `.nc-base-view-tab` as a readiness signal because it only renders for
    // roles with `projectOverviewTab` permission (Creator/Owner). Use the
    // collaborator menu item — visible for all roles after navigating here —
    // as the role-agnostic readiness check.
    await this.rootPage.waitForLoadState('networkidle').catch(() => {});

    await this.dashboard.leftSidebar.sidebarNav
      .getSettingsMenuItemLocator('collaborator')
      .waitFor({ state: 'visible' });

    // small settle window for siblings (settings/data-source) to render or not
    // based on role; we read their visibility synchronously immediately after.
    await this.rootPage.waitForTimeout(500);

    if (role.toLowerCase() === 'creator' || role.toLowerCase() === 'owner') {
      expect(
        await this.dashboard.leftSidebar.sidebarNav.getSettingsMenuItemLocator('collaborator').isVisible()
      ).toBeTruthy();

      expect(
        await this.dashboard.leftSidebar.sidebarNav.getSettingsMenuItemLocator('settings').isVisible()
      ).toBeTruthy();

      expect(
        await this.dashboard.leftSidebar.sidebarNav.getSettingsMenuItemLocator('data-source').isVisible()
      ).toBeTruthy();
    } else {
      expect(
        await this.dashboard.leftSidebar.sidebarNav.getSettingsMenuItemLocator('settings').isVisible()
      ).toBeFalsy();

      expect(
        await this.dashboard.leftSidebar.sidebarNav.getSettingsMenuItemLocator('data-source').isVisible()
      ).toBeFalsy();
    }

    await this.tables.verifyAccess(role);
  }
}
