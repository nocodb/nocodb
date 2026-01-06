import 'mocha';
import { rollupRollupTest } from './tests/rollup-rollup.test';
import { rollupErrorTest } from './tests/rollup-error.test';

function _rollupTests() {
  rollupRollupTest();
  rollupErrorTest();
}

export const rollupTests = runOnSet(2, () => {
  describe('Rollup', _rollupTests);
}
