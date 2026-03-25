import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { isEE } from '../utils/helpers';
import { crossBaseCrudTest } from './crud.spec';
import { crossBaseLookupRollupTest } from './lookup-rollup.spec';
import { crossBaseFormulaTest } from './formula.spec';
import { crossBaseV3DataListTest } from './v3-data-list.spec';

function _crossBaseLinkTests() {
  crossBaseCrudTest();
  crossBaseLookupRollupTest();
  crossBaseFormulaTest();
  crossBaseV3DataListTest();
}

export const crossBaseLinkTests = runOnSet(3, function () {
  if (isEE()) {
    describe('Cross Base Links', _crossBaseLinkTests);
  }
});
