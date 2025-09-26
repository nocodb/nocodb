import 'mocha';
import { rollupRollupTest } from './tests/rollup-rollup.test';

function _rollupTests() {
  rollupRollupTest();
}

// FIXME: run on set 2
export function rollupTests() {
  describe('Rollup', _rollupTests);
}
