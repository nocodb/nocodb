import { expect } from 'chai';
import 'mocha';
import { describeRowError } from '~/modules/jobs/jobs/data-import/error-formatter';

/**
 * Locks in the contract for the error message we surface to the UI when an
 * import row fails. The formatter delegates to the central
 * DBErrorExtractor (shared with the global exception filter and the formula
 * query builder) and layers an import-specific column-name hint on top:
 * when Postgres embeds the offending value in the error text, we match
 * that value back to the row to name the column.
 *
 * Change the helper and this file breaks.
 */
function describeRowErrorTests() {
  describe('describeRowError', () => {
    describe('Postgres SQLSTATE → extractor message', () => {
      it('22001 → "data entered is too long"', () => {
        const err = {
          code: '22001',
          message: 'value too long for type character(3)',
        };
        expect(describeRowError(err)).to.equal(
          'The data entered is too long for this field.',
        );
      });

      it('22P02 → value+type message, no column when none inferred', () => {
        const err = {
          code: '22P02',
          message: 'invalid input syntax for type numeric: "$500.00"',
        };
        expect(describeRowError(err)).to.equal(
          "Invalid value '$500.00' for type 'numeric'",
        );
      });

      it('22008 → date/time out of range, preserves value', () => {
        const err = {
          code: '22008',
          message: 'date/time field value out of range: "05/22/2026"',
        };
        expect(describeRowError(err)).to.equal(
          'Date/time field value out of range: "05/22/2026"',
        );
      });

      it('23502 → required-field message', () => {
        const err = {
          code: '23502',
          message:
            'null value in column "event_date" of relation "test_imports" violates not-null constraint',
        };
        expect(describeRowError(err)).to.equal(
          'A value is required for this field. (column: event_date)',
        );
      });

      it('23505 with detail → column-aware unique violation', () => {
        const err = {
          code: '23505',
          detail: 'Key (status_code)=(ACT) already exists.',
          message:
            'duplicate key value violates unique constraint "test_imports_pkey"',
        };
        expect(describeRowError(err)).to.equal(
          "status_code field unique constraint violation. Value 'ACT' already exists.",
        );
      });
    });

    describe('Row-value matching → column extraction', () => {
      it('matches the embedded $-value back to its column', () => {
        const err = {
          code: '22P02',
          message: 'invalid input syntax for type numeric: "$500.00"',
        };
        const row = {
          event_date: '2026-05-24',
          status_code: 'OK',
          amount: '$500.00',
        };
        // Extractor produces "Invalid value '$500.00' for type 'numeric'".
        // Our layer matches '$500.00' against the row → adds "(column: amount)".
        expect(describeRowError(err, row)).to.equal(
          "Invalid value '$500.00' for type 'numeric' (column: amount)",
        );
      });

      it('matches the embedded date back to its column', () => {
        const err = {
          code: '22008',
          message: 'date/time field value out of range: "05/22/2026"',
        };
        const row = {
          event_date: '05/22/2026',
          status_code: 'ACT',
          amount: '100.00',
        };
        expect(describeRowError(err, row)).to.equal(
          'Date/time field value out of range: "05/22/2026" (column: event_date)',
        );
      });

      it('uses driver-supplied `err.column` over row matching', () => {
        const err = {
          code: '22P02',
          column: 'amount',
          message: 'invalid input syntax for type numeric: "$500.00"',
        };
        const row = { description: '$500.00', amount: '$500.00' };
        // Without the precedence rule, row iteration order would pick
        // `description`. The driver column wins.
        expect(describeRowError(err, row)).to.equal(
          "Invalid value '$500.00' for type 'numeric' (column: amount)",
        );
      });

      it('does not invent a column when nothing matches', () => {
        const err = {
          code: '22001',
          message: 'value too long for type character(3)',
        };
        const row = { event_date: '2026-05-23', status_code: 'PENDING' };
        // 22001 has no value-in-quotes — bare extractor message.
        expect(describeRowError(err, row)).to.equal(
          'The data entered is too long for this field.',
        );
      });

      it('does not duplicate column name when the message already mentions it', () => {
        const err = {
          code: '23502',
          column: 'event_date',
          message:
            'null value in column "event_date" of relation "test_imports" violates not-null constraint',
        };
        // Extractor message already includes the column → no "(column: ...)".
        const result = describeRowError(err);
        expect(result).to.contain('event_date');
        // Only one occurrence — not appended again.
        expect(result.match(/event_date/g)?.length).to.equal(1);
      });
    });

    describe('Fallback when extractor returns nothing', () => {
      it('returns a generic message for non-Error input', () => {
        expect(describeRowError(undefined)).to.equal('Database rejected the row');
        expect(describeRowError(null)).to.equal('Database rejected the row');
        expect(describeRowError('boom')).to.equal('Database rejected the row');
        expect(describeRowError({})).to.equal('Database rejected the row');
      });

      it('does not leak raw text when the code is unknown', () => {
        const err = {
          // `ignoreDefault: true` means unknown codes bypass DefaultExtractor.
          code: 'XX000',
          message:
            'internal_error: deeply weird postgres internal exception nobody should see',
        };
        const out = describeRowError(err);
        expect(out).to.equal('Database rejected the row');
        expect(out).not.to.contain('internal_error');
      });
    });
  });
}

export { describeRowErrorTests };
export default describeRowErrorTests;
