import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import duplicateColumnTest from './duplicate/duplicate-column.test';
import duplicateModelTest from './duplicate/duplicate-model.test';
import duplicateBaseTest from './duplicate/duplicate-base.test';

function _processorTests() {
  duplicateColumnTest();
  duplicateModelTest();
  duplicateBaseTest();
}

export const processorTests = runOnSet(2, function () {
  describe('ProcessorTests', _processorTests);
});
