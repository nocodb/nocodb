import { internalUiViewTests } from './ui-view/index.test';
import { internalDocumentTests } from './documents/index.test';
import { isEE } from '../../../utils/helpers';
import { runOnSet } from '../../../utils/runOnSet';

export const internalTests = runOnSet(2, function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalDocumentTests();

    if(isEE()) {
      try {
        require('./ee/base-trash.test').baseTrashTests();
        require('./ee/base-trash-field.test').baseTrashFieldTests();
        require('./ee/base-trash-table.test').baseTrashTableTests();
        require('./ee/date-dependency.test').dateDependencyTests();
      } catch (e) {
        // EE test files not available in CE
      }
    }
  });
});
