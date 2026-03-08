import { internalUiViewTests } from './ui-view/index.test';
import { internalDocumentTests } from './documents/index.test';
import { dateDependencyTests } from './date-dependency.test';

export const internalTests = function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalDocumentTests();
    dateDependencyTests();
  });
};
