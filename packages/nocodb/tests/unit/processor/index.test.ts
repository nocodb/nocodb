import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import duplicateColumnTest from './duplicate/duplicate-column.test';
import duplicateModelTest from './duplicate/duplicate-model.test';
import duplicateBaseTest from './duplicate/duplicate-base.test';
import linksImportTest from './data-import/links-import.test';

function _processorTests() {
  duplicateColumnTest();
  duplicateModelTest();
  duplicateBaseTest();
  linksImportTest();
}

export const processorTests = runOnSet(3, function () {
  describe('ProcessorTests', _processorTests);
});
