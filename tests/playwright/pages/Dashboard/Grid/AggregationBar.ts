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

  async updateAggregation({ column_name, aggregation }: { column_name: string; aggregation: string }) {
    await this.rootPage.getByTestId(`nc-aggregation-column-${column_name}`).click();

    const overlay = this.rootPage.locator(`.nc-aggregation-${column_name}-overlay`);

    const clickAggregation = (agg: string) => {
      return overlay.getByTestId(`nc-aggregation-${agg}`).click();
    };

    await this.waitForResponse({
      uiAction: () => clickAggregation(aggregation),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: '/api/v2/tables/',
    });
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
