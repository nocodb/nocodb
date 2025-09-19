import 'mocha';
import { rollupRollupTest } from './tests/rollup-rollup.test';
import { rollupErrorTest } from './tests/rollup-error.test';

function _rollupTests() {
  rollupRollupTest();
  rollupErrorTest();
}

// FIXME: run on set 2
export function rollupTests() {
  describe('Rollup', _rollupTests);
}
