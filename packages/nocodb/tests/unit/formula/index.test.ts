import 'mocha';
import { formulaLookupLtarTest } from './tests/formula-lookup-ltar.test';
import { formulaQrBarcodeTest } from './tests/formula-qr-barcode.test';
import { formulaFormulaTest } from './tests/formula-formula.test';

function _formulaTests() {
  formulaLookupLtarTest();
  formulaQrBarcodeTest();
  formulaFormulaTest();
}

export function formulaTests() {
  describe('Formula', _formulaTests);
}
