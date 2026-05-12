import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';

export class TimelinePage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly topbar: TopbarPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
    this.topbar = new TopbarPage(this);
  }

  get() {
    return this.dashboard.rootPage.getByTestId('nc-timeline-wrapper');
  }

  async waitLoading() {
    await this.get().waitFor({ state: 'visible' });
    await this.rootPage.waitForTimeout(1000);
  }

  async getActiveDateLabel() {
    return await this.get().getByTestId('nc-timeline-active-date').textContent();
  }

  async clickToday() {
    await this.get().getByTestId('nc-timeline-today-btn').click();
    await this.rootPage.waitForTimeout(500);
  }

  // The timeline has its own toolbar (`.nc-timeline-toolbar`), so the
  // shared ToolbarPage helpers that anchor on `.nc-table-toolbar` don't
  // resolve here. Scope the fields-menu button click to the timeline
  // wrapper and wait for the dropdown overlay to mount.
  async clickFields() {
    const fieldsMenu = this.rootPage.locator('[data-testid="nc-fields-menu"]');
    const wasOpen = await fieldsMenu.isVisible();
    await this.get().locator('button.nc-fields-menu-btn').click();
    if (wasOpen) await fieldsMenu.waitFor({ state: 'hidden' });
    else await fieldsMenu.waitFor({ state: 'visible' });
  }

  async clickNext() {
    await this.get().getByTestId('nc-timeline-next-btn').click();
    await this.rootPage.waitForTimeout(500);
  }

  async clickPrev() {
    await this.get().getByTestId('nc-timeline-prev-btn').click();
    await this.rootPage.waitForTimeout(500);
  }

  async getBarCount() {
    return await this.get().locator('[data-testid="nc-timeline-bar"]').count();
  }

  async getRecordCountBadge() {
    return await this.get().getByTestId('nc-timeline-record-count').textContent();
  }

  async setZoomLevel(level: 'day' | 'week' | '2week' | 'month' | 'quarter' | '6month' | 'year' | '2year' | '5year') {
    await this.get().getByTestId('nc-timeline-view-mode').click();
    // Match Airtable label conventions used by zoomLabel(): t(`objects.${option}`).
    // The label texts come from i18n; we look up by the option's enum value in the dropdown.
    const dropdown = this.rootPage.locator('.nc-timeline-zoom-dropdown');
    await dropdown.waitFor({ state: 'visible' });
    await dropdown.locator(`[data-value="${level}"]`).first().click();
    await this.rootPage.waitForTimeout(800);
  }

  async verifyEmptyState() {
    await expect(this.get()).toContainText(/No date range configured|noTimelineRange/i);
  }

  async verifyBarsRendered() {
    const count = await this.getBarCount();
    expect(count).toBeGreaterThan(0);
  }
}
