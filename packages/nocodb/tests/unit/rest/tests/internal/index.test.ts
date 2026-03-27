import { internalUiViewTests } from './ui-view/index.test';
import { internalDocumentTests } from './documents/index.test';
import { dateDependencyTests } from './ee/date-dependency.test'
import { isEE } from '../../../utils/helpers';
import { runOnSet } from '../../../utils/runOnSet';

export const internalTests = runOnSet(2, function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalDocumentTests();

    if(isEE()) {
      dateDependencyTests();
    }
  });
});
