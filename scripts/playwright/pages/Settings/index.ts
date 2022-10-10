// playwright-dev-page.ts
import {  Page } from '@playwright/test';
import { AuditSettingsPage } from './Audit';

const tabInfo = {
  'Team & Auth': 'teamAndAuth',
  'App Store': 'appStore',
  'Project Metadata': 'projMetaData',
  'Audit': 'audit',
}


export class SettingsPage {
  private readonly page: Page;
  readonly audit: AuditSettingsPage;

  constructor(page: Page) {
    this.page = page;
    this.audit = new AuditSettingsPage(this);
  }

  get() {
    return this.page.locator('.nc-modal-settings');
  }

  async selectTab({title}: {title: string}) {
    await this.page.locator(`li[data-menu-id="${tabInfo[title]}"]`).click();
  }

  async close() {
    await this.page.locator('[pw-data="settings-modal-close-button"]').click();
  }
}