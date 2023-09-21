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

    // child list body validation (card count, card title)
    const cardCount = cardTitle.length;
    await this.get().locator('.ant-modal-content').waitFor();
    {
      let isOk = false;
      let count = 0;
      let childList;

      while (!isOk && count < 5) {
        try {
          childList = this.get().getByTestId('nc-child-list-item');
          const childCards = await childList.count();
          if (childCards === cardCount) {
            isOk = true;
          }
        } catch (e) {
          await this.rootPage.waitForTimeout(100);
        } finally {
          count++;
        }
      }

      expect(childList).toBeDefined();

      for (let i = 0; i < cardCount; i++) {
        await childList.nth(i).locator('.nc-display-value').waitFor({ state: 'visible' });
        await childList.nth(i).locator('.nc-display-value').scrollIntoViewIfNeeded();
        await this.rootPage.waitForTimeout(100);
        expect(await childList.nth(i).locator('.nc-display-value').textContent()).toContain(cardTitle[i]);
      }
    }
  }

  async close() {
    await this.get().locator(`.nc-close-btn`).click();
    await this.get().waitFor({ state: 'hidden' });
  }

  async openLinkRecord({ linkTableTitle }: { linkTableTitle: string }) {
    const openActions = () => this.get().getByTestId('nc-child-list-button-link-to').click();
    await this.waitForResponse({
      requestUrlPathToMatch: '/exclude',
      httpMethodsToMatch: ['GET'],
      uiAction: openActions,
    });
  }
}
