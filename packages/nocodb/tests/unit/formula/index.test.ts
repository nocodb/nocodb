import 'mocha';
import { formulaLookupLtarTest } from './tests/formula-lookup-ltar.test';
import { formulaQrBarcodeTest } from './tests/formula-qr-barcode.test';

function _formulaTests() {
  formulaLookupLtarTest();
  formulaQrBarcodeTest();
}

export function formulaTests() {
  describe('Formula', _formulaTests);
}
