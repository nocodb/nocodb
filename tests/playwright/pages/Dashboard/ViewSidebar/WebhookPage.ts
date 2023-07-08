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
import { ViewSidebarPage } from './index';
import { Locator } from '@playwright/test';

export class WebhookPage extends BasePage {
  readonly viewSidebar: ViewSidebarPage;

  readonly addHookButton: Locator;
  readonly webhookItems: Locator;

  constructor(viewSidebar: ViewSidebarPage) {
    super(viewSidebar.rootPage);
    this.viewSidebar = viewSidebar;
    this.addHookButton = this.get().locator('.nc-view-sidebar-webhook-plus-icon:visible');
    this.webhookItems = this.get().locator('.nc-view-sidebar-webhook-item');
  }

  get() {
    return this.viewSidebar.get().locator('.nc-view-sidebar-webhook');
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
    await (await this.getItem({ index })).hover();
    await (await this.getItem({ index })).locator('.nc-view-sidebar-webhook-context-menu').hover();
    await this.rootPage.locator('.ant-dropdown').locator('[data-testid="nc-view-sidebar-webhook-copy"]').click();
  }

  async deleteHook({ index }: { index: number }) {
    await (await this.getItem({ index })).hover();
    await (await this.getItem({ index })).locator('.nc-view-sidebar-webhook-context-menu').hover();
    await this.rootPage.locator('.ant-dropdown').locator('[data-testid="nc-view-sidebar-webhook-delete"]').click();
  }
}
