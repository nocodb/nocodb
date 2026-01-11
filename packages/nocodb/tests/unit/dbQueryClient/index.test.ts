import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { pgDBQueryClientTests } from './pg/index.test';

function _dbQueryClientTests() {
  pgDBQueryClientTests();
}

export const dbQueryClientTests = runOnSet(2, function () {
  describe('DBQueryClientTests', _dbQueryClientTests);
});
