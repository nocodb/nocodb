import { DashboardPage } from '..';
import BasePage from '../../Base';
import { TopbarPage } from '../common/Topbar';
import { Locator } from '@playwright/test';
import { WebhookPage } from './WebhookPage';
import { ErdPage } from './ErdPage';

export class DetailsPage extends BasePage {
  readonly dashboard: DashboardPage;
  readonly topbar: TopbarPage;
  readonly webhook: WebhookPage;
  readonly relations: ErdPage;

  readonly tab_webhooks: Locator;
  readonly tab_apiSnippet: Locator;
  readonly tab_fields: Locator;
  readonly tab_relations: Locator;

  readonly btn_addWebhook: Locator;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
    this.topbar = dashboard.grid.topbar;
    this.webhook = new WebhookPage(this);
    this.relations = new ErdPage(this);

    this.tab_webhooks = this.get().locator(`[data-testid="nc-webhooks-tab"]`);
    this.tab_apiSnippet = this.get().locator(`[data-testid="nc-apis-tab"]`);
    this.tab_fields = this.get().locator(`[data-testid="nc-fields-tab"]`);
    this.tab_relations = this.get().locator(`[data-testid="nc-relations-tab"]`);

    this.btn_addWebhook = this.get().locator(`.nc-button:has-text("New Webhook")`).first();
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
    await this.btn_addWebhook.waitFor({ state: 'visible' });
    await this.btn_addWebhook.click();
  }

  async clickRelationsTab() {
    await this.tab_relations.click();
  }
}
