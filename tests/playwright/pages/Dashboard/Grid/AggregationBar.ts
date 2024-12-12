import BasePage from '../../Base';
import { GridPage } from './index';
import { expect } from '@playwright/test';

export class AggregaionBarPage extends BasePage {
  readonly parent: GridPage;

  constructor(parent: GridPage) {
    super(parent.rootPage);
    this.parent = parent;
  }

  get() {
    return this.rootPage.getByTestId('.nc-aggregation-bar');
  }

  async updateAggregation({
    column_name,
    aggregation,
    skipNetworkValidation,
  }: {
    column_name: string;
    aggregation: string;
    skipNetworkValidation?: boolean;
  }) {
    await this.parent.renderColumn(column_name);

    await this.rootPage.getByTestId(`nc-aggregation-column-${column_name}`).click();

    const overlay = this.rootPage.locator(`.nc-aggregation-${column_name}-overlay`);

    const clickAggregation = async (agg: string) => {
      const clickElem = overlay.getByTestId(`nc-aggregation-${agg}`);
      return clickElem.click();
    };

    if (!skipNetworkValidation) {
      await this.waitForResponse({
        uiAction: async () => await clickAggregation(aggregation),
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: '/api/v2/tables/',
      });
    } else {
      await clickAggregation(aggregation);
      await this.rootPage.waitForTimeout(500);
    }
  }

  async verifyAggregation({ column_name, aggregation }) {
    const col = this.rootPage.getByTestId(`nc-aggregation-column-${column_name}`);

    await col.scrollIntoViewIfNeeded();

    const containTextLocator = col.getByTestId('aggregation-value');

    expect(await containTextLocator.innerText()).toContain(aggregation);
  }

  async removeAggregation({ column_name }) {
    const col = this.rootPage.getByTestId(`nc-aggregation-column-${column_name}`);

    await col.scrollIntoViewIfNeeded();

    await col.click();

    const clickAggregation = () => {
      return col.getByTestId('nc-aggregation-none').click();
    };

    await this.waitForResponse({
      uiAction: clickAggregation,
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: '/api/v2/tables/',
    });
  }
}
