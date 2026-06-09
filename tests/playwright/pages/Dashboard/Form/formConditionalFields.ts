import { getTextExcludeIconText } from '../../../tests/utils/general';
import BasePage from '../../Base';
import { FormPage } from './index';
import { expect } from '@playwright/test';

export class FormConditionalFieldsPage extends BasePage {
  readonly parent: FormPage;

  constructor(parent: FormPage) {
    super(parent.rootPage);
    this.parent = parent;
  }

  get() {
    return this.rootPage.getByTestId('nc-form-field-visibility-btn');
  }

  async click() {
    await this.get().waitFor({ state: 'visible' });
    await this.get().click();
    await this.rootPage.getByTestId('nc-filter-menu').waitFor({ state: 'visible' });
  }

  async verify({ isDisabled, count, isVisible }: { isDisabled: boolean; count?: string; isVisible?: boolean }) {
    const conditionalFieldBtn = this.get();

    await conditionalFieldBtn.waitFor({ state: 'visible' });

    if (isDisabled) {
      await expect(conditionalFieldBtn).toHaveClass(/nc-disabled/);
    } else {
      await expect(conditionalFieldBtn).not.toHaveClass(/nc-disabled/);
    }

    if (count !== undefined) {
      const conditionCount = await getTextExcludeIconText(conditionalFieldBtn);

      await expect(conditionCount).toContain(count);
    }

    if (isVisible !== undefined) {
      if (isVisible) {
      }
    }
  }

  async verifyVisibility({ title, isVisible }: { title: string; isVisible: boolean }) {
    const field = this.parent.get().locator(`[data-testid="nc-form-fields"][data-title="${title}"]`);
    await field.scrollIntoViewIfNeeded();

    // The visibility icon swaps via a fade transition, so the leaving + entering icons
    // briefly coexist. Wait deterministically for the transition to settle to a single icon
    // (a fixed sleep races it → strict-mode "resolved to 2 elements"), then assert its state.
    const icon = field.locator('.nc-field-visibility-icon');
    await expect(icon).toHaveCount(1);

    if (isVisible) {
      await expect(icon).toHaveClass(/nc-field-visible/);
    } else {
      await expect(icon).not.toHaveClass(/nc-field-visible/);
    }
  }
}
