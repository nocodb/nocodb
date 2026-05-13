import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { typeAlignmentTests } from './interface-class-alignment.test';

function _typeAlignmentTests() {
  typeAlignmentTests();
}

export const typeAlignmentTestsSuite = runOnSet(1, function () {
  describe('TypeAlignment', _typeAlignmentTests);
});
