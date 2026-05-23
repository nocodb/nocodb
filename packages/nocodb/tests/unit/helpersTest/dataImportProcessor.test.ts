import { expect } from 'chai';
import 'mocha';
import { describeRowError } from '~/modules/jobs/jobs/data-import/error-formatter';

/**
 * Locks in the contract for the error message we surface to the UI when an
 * import row fails. The processor used to push a hardcoded "Failed to
 * insert row" placeholder, then leaked the raw driver text. Both extremes
 * were poor UX — these tests assert the readable, column-aware messages we
 * now produce. Change the helper and this file breaks.
 */
function describeRowErrorTests() {
  describe('describeRowError', () => {
    describe('Postgres SQLSTATE → friendly text', () => {
      it('22001 (string_data_right_truncation) → "Value is too long"', () => {
        const err = {
          code: '22001',
          message: 'value too long for type character(3)',
        };
        expect(describeRowError(err)).to.equal('Value is too long for the column');
      });

      it('22P02 (invalid_text_representation) → "Value does not match the column type"', () => {
        const err = {
          code: '22P02',
          message: 'invalid input syntax for type numeric: "$500.00"',
        };
        expect(describeRowError(err)).to.equal(
          'Value does not match the column type',
        );
      });

      it('22008 (datetime_field_overflow) → "Invalid date or time value"', () => {
        const err = {
          code: '22008',
          message: 'date/time field value out of range: "05/22/2026"',
        };
        expect(describeRowError(err)).to.equal('Invalid date or time value');
      });

      it('23502 (not_null_violation) extracts column from message', () => {
        const err = {
          code: '23502',
          message:
            'null value in column "event_date" of relation "test_imports" violates not-null constraint',
        };
        expect(describeRowError(err)).to.equal(
          'Required column is empty (column: event_date)',
        );
      });

      it('23505 (unique_violation) reports duplicate', () => {
        const err = {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "test_imports_pkey"',
        };
        expect(describeRowError(err)).to.equal(
          'Duplicate value violates a unique constraint',
        );
      });

      it('uses structured `column` field when the driver provides it', () => {
        const err = {
          code: '22001',
          column: 'status_code',
          message: 'value too long for type character(3)',
        };
        expect(describeRowError(err)).to.equal(
          'Value is too long for the column (column: status_code)',
        );
      });
    });

    describe('MySQL errno → friendly text', () => {
      it('1062 (ER_DUP_ENTRY) reports duplicate', () => {
        const err = { errno: 1062, message: "Duplicate entry '1' for key 'PRIMARY'" };
        expect(describeRowError(err)).to.equal(
          'Duplicate value violates a unique constraint',
        );
      });

      it('1366 (ER_TRUNCATED_WRONG_VALUE_FOR_FIELD) → type mismatch', () => {
        const err = {
          errno: 1366,
          message: "Incorrect integer value: 'abc' for column 'amount' at row 1",
        };
        expect(describeRowError(err)).to.equal(
          'Value does not match the column type (column: amount)',
        );
      });

      it('1048 (ER_BAD_NULL_ERROR) → required column empty, extracts column', () => {
        const err = {
          errno: 1048,
          message: "Column 'event_date' cannot be null",
        };
        expect(describeRowError(err)).to.equal(
          'Required column is empty (column: event_date)',
        );
      });
    });

    describe('SQLite / unknown driver → message-pattern fallback', () => {
      it('NOT NULL constraint hits the pattern branch', () => {
        const err = {
          message: 'SQLITE_CONSTRAINT: NOT NULL constraint failed: test_imports.event_date',
        };
        expect(describeRowError(err)).to.equal('Required column is empty');
      });

      it('UNIQUE constraint hits the pattern branch', () => {
        const err = {
          message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: test_imports.id',
        };
        expect(describeRowError(err)).to.equal(
          'Duplicate value violates a unique constraint',
        );
      });
    });

    describe('Fallback when nothing matches', () => {
      it('returns a generic message for non-Error input', () => {
        expect(describeRowError(undefined)).to.equal('Database rejected the row');
        expect(describeRowError(null)).to.equal('Database rejected the row');
        expect(describeRowError('boom')).to.equal('Database rejected the row');
        expect(describeRowError({})).to.equal('Database rejected the row');
      });

      it('does not leak raw SQL text when no pattern matches', () => {
        const err = {
          code: 'XX000',
          message:
            'internal_error: deeply weird postgres internal exception nobody should see',
        };
        const out = describeRowError(err);
        expect(out).to.equal('Database rejected the row');
        expect(out).not.to.contain('internal_error');
        expect(out).not.to.contain('postgres');
      });
    });
  });
}

export { describeRowErrorTests };
export default describeRowErrorTests;
