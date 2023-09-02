import BasePage from '../../../../Base';
import { DashboardPage } from '../../../index';
import { expect } from '@playwright/test';

export class ChildList extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-child-list`);
  }

  async verify({ cardTitle, linkField }: { cardTitle: string[]; linkField: string }) {
    // DOM element validation
    //    title: Child list
    //    button: Link to 'City'
    //    icon: reload
    await expect(this.get().locator(`.ant-modal-title`)).toHaveText(`Child list`);
    expect(await this.get().locator(`text=/Link to '.*${linkField}'/i`).isVisible()).toBeTruthy();
    expect(await this.get().locator(`[data-testid="nc-child-list-reload"]`).isVisible()).toBeTruthy();

    // child list body validation (card count, card title)
    const cardCount = cardTitle.length;
    await this.get().locator('.ant-modal-content').waitFor();
    {
      const childList = this.get().locator(`.ant-card`);
      const childCards = await childList.count();
      expect(childCards).toEqual(cardCount);
      for (let i = 0; i < cardCount; i++) {
        await childList.nth(i).locator('.name').waitFor({ state: 'visible' });
        await childList.nth(i).locator('.name').scrollIntoViewIfNeeded();
        await this.rootPage.waitForTimeout(100);
        expect(await childList.nth(i).locator('.name').textContent()).toContain(cardTitle[i]);
        // icon: unlink
        // icon: delete
        expect(await childList.nth(i).locator(`[data-testid="nc-child-list-icon-unlink"]`).isVisible()).toBeTruthy();
        expect(await childList.nth(i).locator(`[data-testid="nc-child-list-icon-delete"]`).isVisible()).toBeTruthy();
      }
    }
  }

  async close() {
    await this.get().locator(`.ant-modal-close-x`).click();
    await this.get().waitFor({ state: 'hidden' });
  }

  async openLinkRecord({ linkTableTitle }: { linkTableTitle: string }) {
    const openActions = () => this.get().locator(`text=/Link to '.*${linkTableTitle}'/i`).click();
    await this.waitForResponse({
      requestUrlPathToMatch: '/exclude',
      httpMethodsToMatch: ['GET'],
      uiAction: openActions,
    });
  }
}
