import { expect } from 'chai';
import 'mocha';
import { UITypes } from 'nocodb-sdk';
import {
  escapeCsvFormulaValue,
  escapeFormulaeInRows,
  NC_FORMULA_ESCAPE_SKIP_UITYPES,
} from '~/helpers/csvFormulaEscape';

function csvFormulaEscapeTests() {
  describe('escapeCsvFormulaValue', () => {
    it('prefixes a single quote to formula-leading strings', () => {
      expect(escapeCsvFormulaValue('=HYPERLINK("x")')).to.equal(
        `'=HYPERLINK("x")`,
      );
      expect(escapeCsvFormulaValue('+1+1')).to.equal(`'+1+1`);
      expect(escapeCsvFormulaValue('-2+3')).to.equal(`'-2+3`);
      expect(escapeCsvFormulaValue('@SUM(A1)')).to.equal(`'@SUM(A1)`);
      expect(escapeCsvFormulaValue('\t=cmd')).to.equal(`'\t=cmd`);
      expect(escapeCsvFormulaValue('\r=cmd')).to.equal(`'\r=cmd`);
    });

    it('leaves non-formula strings untouched', () => {
      expect(escapeCsvFormulaValue('hello')).to.equal('hello');
      expect(escapeCsvFormulaValue('a=b')).to.equal('a=b');
      expect(escapeCsvFormulaValue('')).to.equal('');
    });

    it('leaves non-string values untouched', () => {
      expect(escapeCsvFormulaValue(5)).to.equal(5);
      expect(escapeCsvFormulaValue(-5)).to.equal(-5);
      expect(escapeCsvFormulaValue(null)).to.equal(null);
      expect(escapeCsvFormulaValue(undefined)).to.equal(undefined);
      expect(escapeCsvFormulaValue(true)).to.equal(true);
    });
  });

  describe('escapeFormulaeInRows', () => {
    const columns = [
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'Note', uidt: UITypes.LongText },
      { title: 'Amount', uidt: UITypes.Number },
      { title: 'Price', uidt: UITypes.Currency },
      { title: 'Due', uidt: UITypes.Date },
    ];

    it('escapes formula-leading text cells but preserves numeric/temporal cells', () => {
      const rows: any[] = [
        {
          Name: '=HYPERLINK("evil")',
          Note: '+cmd|calc',
          Amount: '-5',
          Price: '-12.50',
          Due: '-001',
        },
      ];

      escapeFormulaeInRows(rows, columns);

      expect(rows[0].Name).to.equal(`'=HYPERLINK("evil")`);
      expect(rows[0].Note).to.equal(`'+cmd|calc`);
      // numeric/temporal columns must NOT be mutated (legitimate leading -)
      expect(rows[0].Amount).to.equal('-5');
      expect(rows[0].Price).to.equal('-12.50');
      expect(rows[0].Due).to.equal('-001');
    });

    it('escapes keys with no matching column (secure default)', () => {
      const rows: any[] = [{ Unknown: '=danger' }];
      escapeFormulaeInRows(rows, columns);
      expect(rows[0].Unknown).to.equal(`'=danger`);
    });

    it('handles empty input without throwing', () => {
      expect(() => escapeFormulaeInRows([], columns)).to.not.throw();
      expect(() => escapeFormulaeInRows(null as any, columns)).to.not.throw();
    });

    it('skip-set contains numeric/temporal types but not text types', () => {
      expect(NC_FORMULA_ESCAPE_SKIP_UITYPES.has(UITypes.Number)).to.equal(true);
      expect(NC_FORMULA_ESCAPE_SKIP_UITYPES.has(UITypes.Date)).to.equal(true);
      expect(NC_FORMULA_ESCAPE_SKIP_UITYPES.has(UITypes.Currency)).to.equal(
        true,
      );
      expect(
        NC_FORMULA_ESCAPE_SKIP_UITYPES.has(UITypes.SingleLineText),
      ).to.equal(false);
      expect(NC_FORMULA_ESCAPE_SKIP_UITYPES.has(UITypes.LongText)).to.equal(
        false,
      );
    });
  });
}

export function csvFormulaEscapeTest() {
  describe('csvFormulaEscape.test', csvFormulaEscapeTests);
}
