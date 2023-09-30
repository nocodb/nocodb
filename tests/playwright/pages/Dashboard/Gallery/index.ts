import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';

export class GalleryPage extends BasePage {
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
    return this.dashboard.get().locator('[data-testid="nc-gallery-wrapper"]');
  }

  card(index: number) {
    return this.get().locator(`.ant-card`).nth(index);
  }

  async openExpandedRow({ index }: { index: number }) {
    await this.card(index).click({
      position: {
        x: 1,
        y: 1,
      },
    });
  }

  // todo: Wait for render to complete
  async waitLoading() {
    await this.rootPage.waitForTimeout(1000);
  }
}
