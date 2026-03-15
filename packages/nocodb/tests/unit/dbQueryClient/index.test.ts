import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { pgDBQueryClientTests } from './pg/index.test';
import { pgMassUpdateTests } from './pg/massUpdate.test';

function _dbQueryClientTests() {
  pgDBQueryClientTests();
  pgMassUpdateTests();
}

export const dbQueryClientTests = runOnSet(2, function () {
  describe('DBQueryClientTests', _dbQueryClientTests);
});
