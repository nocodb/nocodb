import { internalUiViewTests } from './ui-view/index.test';

export const internalTests = function () {
  describe('Internal API', () => {
    internalUiViewTests();
  });
};
