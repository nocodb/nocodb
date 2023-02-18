import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';

export class MapPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
  }

  get() {
    return this.dashboard.get().locator('[data-testid="nc-map-wrapper"]');
  }

  marker(lat: string, long: string) {
    const latLongStr = `${lat}, ${long}`;
    return this.get().locator(`.leaflet-marker-pane img[alt="${latLongStr}"]`);
  }

  async zoomOut(times = 10) {
    const zoomOutButton = await this.get().locator('.leaflet-control-zoom-out');
    for (let i = 0; i < times; i++) {
      await zoomOutButton.click();
      await this.rootPage.waitForTimeout(400);
    }
  }

  // async openExpandedRow({ index }: { index: number }) {
  //   await this.card(index).click();
  //   await (await this.rootPage.locator('.ant-drawer-body').elementHandle())?.waitForElementState('stable');
  // }

  // todo: Wait for render to complete
  async waitLoading() {
    await this.rootPage.waitForTimeout(1000);
  }
}
