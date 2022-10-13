import {  expect } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';

export class MetaDataPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[pw-data="nc-settings-subtab-Metadata"]`);
  }

  async clickReload(){
    await this.get().locator(`button:has-text("Reload")`).click();

    // todo: Remove this wait
    await this.rootPage.waitForTimeout(100);
    // await this.get().locator(`.animate-spin`).waitFor({state: 'visible'});
    await this.get().locator(`.animate-spin`).waitFor({state: 'detached'});
  }

  async sync(){
    await this.get().locator(`button:has-text("Sync Now")`).click();
    await this.toastWait({message: 'Table metadata recreated successfully'});
    await this.get().locator(`.animate-spin`).waitFor({state: 'visible'});
    await this.get().locator(`.animate-spin`).waitFor({state: 'detached'});
  }

  async verifyRow(
    {index, model, state}: 
    {index: number,model: string, state: string}
    ) {
    await expect.poll(async () => {
      return await this.get().locator(`tr.ant-table-row`).nth(index).locator(`td.ant-table-cell`).nth(0).textContent();
    }).toContain(model);
    expect(await this.get().locator(`tr.ant-table-row`).nth(index).locator(`td.ant-table-cell`).nth(1).textContent()).toContain(state);
  }
}