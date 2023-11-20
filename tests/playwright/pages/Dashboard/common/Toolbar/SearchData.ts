import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { expect } from '@playwright/test';

export class ToolbarSearchDataPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.getByTestId('search-data-input');
  }

  async verify(query: string) {
    expect(await this.get().inputValue()).toBe(query);
  }
}
