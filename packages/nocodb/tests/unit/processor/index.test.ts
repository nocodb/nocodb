import 'mocha';
import duplicateColumnTest from './duplicate/duplicate-column.test';

function _processorTests() {
  duplicateColumnTest();
}

export function processorTests() {
  describe('ProcessorTests', _processorTests);
}
