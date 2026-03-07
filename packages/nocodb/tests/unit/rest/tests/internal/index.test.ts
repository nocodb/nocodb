import { internalUiViewTests } from './ui-view/index.test';
import { internalDocumentTests } from './documents/index.test';

export const internalTests = function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalDocumentTests();
  });
};
