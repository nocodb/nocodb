import 'mocha';
import { runOnSet } from '../utils/runOnSet';
import { formulaLookupLtarTest } from './tests/formula-lookup-ltar.test';
import { formulaQrBarcodeTest } from './tests/formula-qr-barcode.test';
import { formulaFormulaTest } from './tests/formula-formula.test';
import { formulaErrorTest } from './tests/formula-error.test';

function _formulaTests() {
  formulaLookupLtarTest();
  formulaQrBarcodeTest();
  formulaFormulaTest();
  formulaErrorTest();
}

export const formulaTests = runOnSet(2, function () {
  describe('Formula', _formulaTests);
});
