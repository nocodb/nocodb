import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { rollupRollupTest } from './tests/rollup-rollup.test';
import { rollupErrorTest } from './tests/rollup-error.test';

function _rollupTests() {
  rollupRollupTest();
  rollupErrorTest();
}

export const rollupTests = runOnSet(3, function () {
  describe('Rollup', _rollupTests);
});
