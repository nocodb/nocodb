import 'mocha';
import duplicateColumnTest from './duplicate/duplicate-column.test';
import duplicateModelTest from './duplicate/duplicate-model.test';
import duplicateBaseTest from './duplicate/duplicate-base.test';

function _processorTests() {
  duplicateColumnTest();
  duplicateModelTest();
  duplicateBaseTest();
}

export function processorTests() {
  describe('ProcessorTests', _processorTests);
}
