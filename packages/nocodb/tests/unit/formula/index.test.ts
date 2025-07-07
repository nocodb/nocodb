import 'mocha';
import { formulaLookupLtarTest } from './tests/formula-lookup-ltar.test';

function _formulaTests() {
  formulaLookupLtarTest();
}

export function formulaTests() {
  describe('Formula', _formulaTests);
}
