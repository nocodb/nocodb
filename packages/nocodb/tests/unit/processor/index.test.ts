import 'mocha';
import duplicateColumnTest from './duplicate/duplicate-column.test';
import duplicateModelTest from './duplicate/duplicate-model.test';

function _processorTests() {
  duplicateColumnTest();
  duplicateModelTest();
}

export function processorTests() {
  describe('ProcessorTests', _processorTests);
}
