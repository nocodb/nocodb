import 'mocha';
import { runOnSet } from '../../utils/runOnSet';
import { pgTemporaryTableTests } from './temporaryTable.test';
import { isEE } from '../../utils/helpers';

function _pgDBQueryClientTests() {
  pgTemporaryTableTests();
}

export const pgDBQueryClientTests = runOnSet(2, function () {
  if (isEE()) {
    describe('PGDBQueryClientTests', _pgDBQueryClientTests);
  }
});
