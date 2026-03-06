import { internalUiViewTests } from './ui-view/index.test';
import { internalUiGetTests } from './ui-get/index.test';

export const internalTests = function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalUiGetTests();
  });
};
