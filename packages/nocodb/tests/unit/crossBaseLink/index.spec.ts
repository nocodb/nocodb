import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { isEE } from '../utils/helpers';
import { crossBaseCrudTest } from './crud.spec';
import { crossBaseLookupRollupTest } from './lookup-rollup.spec';
import { crossBaseFormulaTest } from './formula.spec';

function _crossBaseLinkTests() {
  crossBaseCrudTest();
  crossBaseLookupRollupTest();
  crossBaseFormulaTest();
}

export const crossBaseLinkTests = runOnSet(2, function () {
  if (isEE()) {
    describe('Cross Base Links', _crossBaseLinkTests);
  }
});
