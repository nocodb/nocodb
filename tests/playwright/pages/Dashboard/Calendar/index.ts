import { DashboardPage } from '..';
import BasePage from '../../Base';
import { ToolbarPage } from '../common/Toolbar';
import { TopbarPage } from '../common/Topbar';
import { CalendarTopbarPage } from './CalendarTopBar';

export class CalendarPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly toolbar: ToolbarPage;
  readonly topbar: TopbarPage;
  readonly calendarTopbar: CalendarTopbarPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.toolbar = new ToolbarPage(this);
    this.topbar = new TopbarPage(this);
    this.calendarTopbar = new CalendarTopbarPage(this);
  }

  get() {
    return this.get().getByTestId('nc-calendar-wrapper');
  }

  async waitLoading() {
    await this.rootPage.waitForTimeout(2000);
  }
}
