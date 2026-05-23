import { expect } from 'chai';
import 'mocha';
import { describeRowError } from '~/modules/jobs/jobs/data-import/error-formatter';

/**
 * Locks in the contract for the error message we surface to the UI when an
 * import row fails. Before this helper existed, the processor pushed a
 * hardcoded 'Failed to insert row' string into `stats.errors`, so the toast
 * never showed why Postgres / MySQL had actually rejected the row. The
 * tests below assert the shape of what now reaches the frontend — change
 * the helper and this file breaks.
 */
function describeRowErrorTests() {
  describe('describeRowError', () => {
    it('returns the message of a normal Error', () => {
      expect(describeRowError(new Error('invalid input syntax for type numeric: "$500.00"'))).to.equal(
        'invalid input syntax for type numeric: "$500.00"',
      );
    });

    it('collapses interior whitespace and newlines so a toast renders cleanly', () => {
      const raw = 'value too long\n  for type character(3)\r\n';
      expect(describeRowError({ message: raw })).to.equal('value too long for type character(3)');
    });

    it('clips messages at 240 chars (raw DB stack traces can be huge)', () => {
      const long = 'x'.repeat(1000);
      const out = describeRowError({ message: long });
      expect(out.length).to.equal(240);
      expect(out).to.equal('x'.repeat(240));
    });

    it('falls back to a generic string when the error has no usable message', () => {
      expect(describeRowError(undefined)).to.equal('Failed to insert row');
      expect(describeRowError(null)).to.equal('Failed to insert row');
      expect(describeRowError('boom')).to.equal('Failed to insert row');
      expect(describeRowError({})).to.equal('Failed to insert row');
      expect(describeRowError({ message: 123 })).to.equal('Failed to insert row');
      expect(describeRowError({ message: '' })).to.equal('Failed to insert row');
    });

    it('preserves the original message for typical Postgres date/range errors', () => {
      // Real shape of err.message from `pg` driver — must reach the user
      // intact (the bug it replaces was masking this entirely).
      const pgDate = 'date/time field value out of range: "05/22/2026"';
      expect(describeRowError(new Error(pgDate))).to.equal(pgDate);
    });
  });
}

export { describeRowErrorTests };
export default describeRowErrorTests;
