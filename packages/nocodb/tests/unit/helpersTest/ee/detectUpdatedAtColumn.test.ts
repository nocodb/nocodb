import 'mocha';
import { expect } from 'chai';
import { detectUpdatedAtColumn } from '@noco-local-integrations/core';

/**
 * `detectUpdatedAtColumn` picks the incremental-sync cursor column
 * (`systemFields.updatedAt`) for custom DB syncs: the first date/datetime
 * column whose name matches a well-known last-modified pattern.
 */
export const detectUpdatedAtColumnTests = () => {
  describe('detectUpdatedAtColumn', () => {
    it('picks a datetime updated_at column', () => {
      expect(
        detectUpdatedAtColumn([
          { title: 'id', abstractType: 'number' },
          { title: 'name', abstractType: 'string' },
          { title: 'updated_at', abstractType: 'datetime' },
        ]),
      ).to.equal('updated_at');
    });

    it('matches case-insensitively but returns the original title', () => {
      expect(
        detectUpdatedAtColumn([
          { title: 'Last_Update', abstractType: 'datetime' },
        ]),
      ).to.equal('Last_Update');
    });

    it('prefers earlier candidates over later ones', () => {
      // `updated_at` outranks `last_update` regardless of column order.
      expect(
        detectUpdatedAtColumn([
          { title: 'last_update', abstractType: 'datetime' },
          { title: 'updated_at', abstractType: 'datetime' },
        ]),
      ).to.equal('updated_at');
    });

    it('ignores name matches that are not date/datetime columns', () => {
      // A text `updated_at` can't be a cursor — fall through to the next
      // candidate that IS a temporal column.
      expect(
        detectUpdatedAtColumn([
          { title: 'updated_at', abstractType: 'string' },
          { title: 'last_modified', abstractType: 'datetime' },
        ]),
      ).to.equal('last_modified');
    });

    it('accepts date (not just datetime) columns', () => {
      expect(
        detectUpdatedAtColumn([{ title: 'modified_on', abstractType: 'date' }]),
      ).to.equal('modified_on');
    });

    it('returns undefined when no candidate matches', () => {
      expect(
        detectUpdatedAtColumn([
          { title: 'id', abstractType: 'number' },
          { title: 'created_at', abstractType: 'datetime' },
          { title: 'note', abstractType: 'string' },
        ]),
      ).to.equal(undefined);
    });

    it('returns undefined for columns without an abstract type', () => {
      expect(detectUpdatedAtColumn([{ title: 'updated_at' }])).to.equal(
        undefined,
      );
    });
  });
};
