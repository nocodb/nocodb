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
    this.webhookItems = this.get().locator('.nc-table-row');
  }

  get() {
    return this.detailsPage.get().locator('.nc-table-wrapper');
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

  async itemContextMenu({ index, operation }: { index: number; operation: 'edit' | 'duplicate' | 'delete' }) {
    await (await this.getItem({ index })).getByTestId('nc-webhook-item-action').click();

    const contextMenu = this.rootPage.locator('.nc-webhook-item-action-dropdown:visible');
    await contextMenu.waitFor({ state: 'visible' });

    await contextMenu.getByTestId(`nc-webhook-item-action-${operation}`).click();

    await contextMenu.waitFor({ state: 'hidden' });
  }

  async deleteHook({ index }: { index: number }) {
    return await this.itemContextMenu({ index, operation: 'delete' });
  }
}
