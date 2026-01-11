import 'mocha';
import { runOnSet } from '../../utils/runOnSet';
import { pgTemporaryTableTests } from './temporaryTable.test';

function _pgDBQueryClientTests() {
  pgTemporaryTableTests();
}

export const pgDBQueryClientTests = runOnSet(2, function () {
  describe('PGDBQueryClientTests', _pgDBQueryClientTests);
});
