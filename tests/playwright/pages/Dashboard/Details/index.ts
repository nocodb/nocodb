import { DashboardPage } from '..';
import BasePage from '../../Base';
import { TopbarPage } from '../common/Topbar';
import { Locator } from '@playwright/test';
import { WebhookPage } from './WebhookPage';

export class DetailsPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly topbar: TopbarPage;
  readonly webhook: WebhookPage;

  readonly tab_webhooks: Locator;
  readonly tab_apiSnippet: Locator;

  readonly btn_addWebhook: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.topbar = dashboard.grid.topbar;
    this.webhook = new WebhookPage(this);

    this.tab_webhooks = this.get().locator(`.nc-tab:has-text("Webhooks")`);
    this.tab_apiSnippet = this.get().locator(`.nc-tab:has-text("APIs")`);

    this.btn_addWebhook = this.get().locator(`.nc-button:has-text("Add Webhook")`);
  }

  get() {
    return this.dashboard.get().locator('[data-testid="nc-details-wrapper"]');
  }

  async clickWebhooksTab() {
    await this.tab_webhooks.click();
  }

  async clickApiSnippetTab() {
    await this.tab_apiSnippet.click();
  }

  async clickAddWebhook() {
    await this.btn_addWebhook.click();
  }
}
