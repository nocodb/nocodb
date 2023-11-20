import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';

export class MapPage extends BasePage {
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
    return this.dashboard.get().locator('[data-testid="nc-map-wrapper"]');
  }

  async marker(lat: string, long: string) {
    const latLongStr = `${lat}, ${long}`;
    const marker = this.get().locator(`.leaflet-marker-pane img[alt="${latLongStr}"]`);
    return marker;
  }

  async clickAddRowButton() {
    await this.rootPage.locator('.nc-add-new-row-btn').click();
  }

  async clickMarker(lat: string, long: string) {
    return (await this.marker(lat, long)).click();
  }

  async verifyMarkerCount(count: number) {
    const markers = this.get().locator('.leaflet-marker-pane img');
    await expect(markers).toHaveCount(count);
  }

  async zoomOut(times = 10) {
    const zoomOutButton = this.get().locator('.leaflet-control-zoom-out');
    for (let i = 0; i < times; i++) {
      await zoomOutButton.click();
      await this.rootPage.waitForTimeout(400);
    }
  }

  // todo: Wait for render to complete
  async waitLoading() {
    await this.rootPage.waitForTimeout(1000);
  }
}
