// Webhook
//  nc-view-sidebar-webhook
//  nc-view-sidebar-webhook-label
//  nc-view-sidebar-webhook-plus-icon
//    nc-view-sidebar-webhook-context-menu
//      nc-view-sidebar-webhook-menu-item
//        data-testid="nc-view-sidebar-webhook-context-menu"
//          data-testid="nc-view-sidebar-webhook-copy"
//          data-testid="nc-view-sidebar-webhook-delete"

import BasePage from '../../Base';
import { Locator } from '@playwright/test';
import { DetailsPage } from './index';

export class WebhookPage extends BasePage {
  readonly detailsPage: DetailsPage;

  readonly addHookButton: Locator;
  readonly webhookItems: Locator;

  constructor(details: DetailsPage) {
    super(details.rootPage);
    this.detailsPage = details;
    this.addHookButton = this.get().locator('.nc-view-sidebar-webhook-plus-icon:visible');
    this.webhookItems = this.get().locator('.nc-view-sidebar-webhook-item');
  }

  get() {
    return this.detailsPage.get().locator('.nc-view-sidebar-webhook');
  }

  async itemCount() {
    return await this.webhookItems.count();
  }

  async getItem({ index }: { index: number }) {
    return this.webhookItems.nth(index);
  }

  async addHook() {
    await this.addHookButton.click();
  }

  async copyHook({ index }: { index: number }) {
    const hookItem = await this.getItem({ index });
    await hookItem.hover();
    await hookItem.locator('[data-testid="nc-view-sidebar-webhook-context-menu"]').click();
    await this.rootPage
      .locator('.ant-dropdown:visible')
      .locator('[data-testid="nc-view-sidebar-webhook-copy"]')
      .click();
  }

  async deleteHook({ index }: { index: number }) {
    const hookItem = await this.getItem({ index });
    await hookItem.hover();
    await hookItem.locator('.nc-button.nc-btn-webhook-more').click({ force: true });
    await this.rootPage.locator('.ant-dropdown:visible').locator('button.ant-btn:has-text("Delete")').click();
  }
}
