import { expect } from 'chai';
import 'mocha';
import {
  detectColumnSchemaPropsChanged,
  isPkRegression,
  resolvePkAfterSync,
} from '~/services/meta-diffs/pk-preservation';

/**
 * Locks in the asymmetric handling of `pk` between NocoDB metadata and
 * the external DB schema during meta-sync.
 *
 * Background: customers whose source PG/MySQL schema declares uniqueness
 * via `UNIQUE NOT NULL` instead of `PRIMARY KEY` get imported into NocoDB
 * with `pk:false` on every column. They can recover by manually flagging
 * the `id` column as PK in NocoDB. The next meta-sync must preserve that
 * flip — without these helpers, the symmetric diff would strip it and
 * the recovery would un-stick on every resync.
 *
 * If you change the helper, this file breaks.
 */
export function pkPreservationTests() {
  describe('pk-preservation', () => {
    describe('isPkRegression', () => {
      it('returns true when NocoDB has pk and the DB column does not', () => {
        expect(isPkRegression(true, false)).to.equal(true);
      });

      it('returns false when DB gains pk and NocoDB does not yet have it', () => {
        expect(isPkRegression(false, true)).to.equal(false);
      });

      it('returns false when both sides agree on pk:true', () => {
        expect(isPkRegression(true, true)).to.equal(false);
      });

      it('returns false when both sides agree on pk:false', () => {
        expect(isPkRegression(false, false)).to.equal(false);
      });

      it('treats null and undefined as falsy on both sides', () => {
        expect(isPkRegression(null, undefined)).to.equal(false);
        expect(isPkRegression(undefined, null)).to.equal(false);
        expect(isPkRegression(true, null)).to.equal(true);
        expect(isPkRegression(true, undefined)).to.equal(true);
        expect(isPkRegression(null, true)).to.equal(false);
        expect(isPkRegression(undefined, true)).to.equal(false);
      });
    });

    describe('detectColumnSchemaPropsChanged', () => {
      const same = {
        pk: false,
        rqd: false,
        un: false,
        ai: false,
        unique: false,
      };

      it('returns false when nothing changed', () => {
        expect(detectColumnSchemaPropsChanged(same, same)).to.equal(false);
      });

      it('returns true when DB gains a pk and NocoDB does not have one', () => {
        expect(
          detectColumnSchemaPropsChanged(same, { ...same, pk: true }),
        ).to.equal(true);
      });

      it('returns false for a pk regression alone — user-set NocoDB pk must survive', () => {
        // NocoDB has manually-flagged pk:true; DB never declared PRIMARY KEY.
        expect(
          detectColumnSchemaPropsChanged({ ...same, pk: true }, same),
        ).to.equal(false);
      });

      it('returns true when a sibling prop changed even alongside a pk regression', () => {
        // pk regression alone wouldn't fire — but the rqd flip still must.
        expect(
          detectColumnSchemaPropsChanged(
            { ...same, pk: true, rqd: false },
            { ...same, pk: false, rqd: true },
          ),
        ).to.equal(true);
      });

      it('returns true on rqd / un / ai / unique changes individually', () => {
        expect(
          detectColumnSchemaPropsChanged(same, { ...same, rqd: true }),
        ).to.equal(true);
        expect(
          detectColumnSchemaPropsChanged(same, { ...same, un: true }),
        ).to.equal(true);
        expect(
          detectColumnSchemaPropsChanged(same, { ...same, ai: true }),
        ).to.equal(true);
        expect(
          detectColumnSchemaPropsChanged(same, { ...same, unique: true }),
        ).to.equal(true);
      });

      it('treats null / undefined as falsy when comparing', () => {
        expect(
          detectColumnSchemaPropsChanged(
            { pk: null, rqd: null, un: null, ai: null, unique: null },
            same,
          ),
        ).to.equal(false);
        expect(
          detectColumnSchemaPropsChanged(
            { pk: undefined, rqd: undefined, un: undefined, ai: undefined, unique: undefined },
            same,
          ),
        ).to.equal(false);
      });
    });

    describe('resolvePkAfterSync', () => {
      it('preserves NocoDB pk when the DB column reports no pk (user-set ratchet)', () => {
        expect(resolvePkAfterSync(true, false)).to.equal(true);
      });

      it('propagates a pk gained on the DB side', () => {
        expect(resolvePkAfterSync(false, true)).to.equal(true);
      });

      it('returns true when both sides have pk', () => {
        expect(resolvePkAfterSync(true, true)).to.equal(true);
      });

      it('returns false when neither side has pk', () => {
        expect(resolvePkAfterSync(false, false)).to.equal(false);
      });

      it('handles null / undefined as falsy', () => {
        expect(resolvePkAfterSync(null, null)).to.equal(false);
        expect(resolvePkAfterSync(undefined, undefined)).to.equal(false);
        expect(resolvePkAfterSync(undefined, true)).to.equal(true);
        expect(resolvePkAfterSync(true, undefined)).to.equal(true);
        expect(resolvePkAfterSync(null, true)).to.equal(true);
        expect(resolvePkAfterSync(true, null)).to.equal(true);
      });
    });
  });
}
