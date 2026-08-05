import {
  isColumnPropModified,
  payloadModifiesColumn,
} from '~/helpers/columnPropDiff';

/**
 * Regression cover for nocodb#14348.
 *
 * The column PATCH guards used to answer "is the client modifying this column?"
 * from `Object.keys(payload)`, so echoing a column's own title back at it read
 * as a rename and was rejected with ERR_SYSTEM_FIELD_NON_MODIFIABLE. These
 * tests pin the value-diff semantics that replaced that check.
 */
describe('columnPropDiff', () => {
  // Booleans come back as 0/1 from SQLite/MySQL and as real booleans from
  // Postgres, which is why the boolean props are compared on truthiness.
  const storedColumn = {
    id: 'c1',
    title: 'Id',
    column_name: 'id',
    uidt: 'ID',
    dt: 'integer',
    dtxp: '11',
    cdf: null,
    description: null,
    pk: 1,
    rqd: 0,
    ai: 1,
    unique: 0,
    meta: { x: 1 },
  };

  describe('isColumnPropModified', () => {
    it('treats an absent prop as unchanged, never as a request to clear it', () => {
      expect(isColumnPropModified(storedColumn, {}, 'title')).toBe(false);
      expect(
        isColumnPropModified(storedColumn, { description: 'x' }, 'title'),
      ).toBe(false);
    });

    it('treats a prop resubmitted with its stored value as a no-op', () => {
      expect(isColumnPropModified(storedColumn, { title: 'Id' }, 'title')).toBe(
        false,
      );
      expect(
        isColumnPropModified(storedColumn, { column_name: 'id' }, 'column_name'),
      ).toBe(false);
      expect(isColumnPropModified(storedColumn, { uidt: 'ID' }, 'uidt')).toBe(
        false,
      );
      expect(isColumnPropModified(storedColumn, { id: 'c1' }, 'id')).toBe(false);
    });

    it('still detects a genuine change', () => {
      expect(
        isColumnPropModified(storedColumn, { title: 'Renamed' }, 'title'),
      ).toBe(true);
      expect(
        isColumnPropModified(storedColumn, { column_name: 'x' }, 'column_name'),
      ).toBe(true);
      expect(
        isColumnPropModified(
          storedColumn,
          { uidt: 'SingleLineText' },
          'uidt',
        ),
      ).toBe(true);
      expect(isColumnPropModified(storedColumn, { title: '' }, 'title')).toBe(
        true,
      );
      expect(isColumnPropModified(storedColumn, { title: null }, 'title')).toBe(
        true,
      );
    });

    it('compares boolean props on truthiness across driver representations', () => {
      expect(isColumnPropModified(storedColumn, { pk: true }, 'pk')).toBe(false);
      expect(isColumnPropModified(storedColumn, { pk: 1 }, 'pk')).toBe(false);
      expect(isColumnPropModified(storedColumn, { pk: false }, 'pk')).toBe(true);

      expect(isColumnPropModified(storedColumn, { rqd: false }, 'rqd')).toBe(
        false,
      );
      expect(isColumnPropModified(storedColumn, { rqd: true }, 'rqd')).toBe(
        true,
      );
      expect(isColumnPropModified(storedColumn, { unique: 0 }, 'unique')).toBe(
        false,
      );
    });

    it('treats null and undefined as the same absence of a value', () => {
      expect(isColumnPropModified(storedColumn, { cdf: null }, 'cdf')).toBe(
        false,
      );
      expect(isColumnPropModified(storedColumn, { cdf: undefined }, 'cdf')).toBe(
        false,
      );
      expect(isColumnPropModified(storedColumn, { cdf: '5' }, 'cdf')).toBe(true);
    });

    it('coerces scalars, since column meta is stored as text', () => {
      expect(isColumnPropModified(storedColumn, { dtxp: 11 }, 'dtxp')).toBe(
        false,
      );
      expect(isColumnPropModified(storedColumn, { dtxp: '12' }, 'dtxp')).toBe(
        true,
      );
    });

    it('reports structured props as modified, keeping the guard as strict as before', () => {
      expect(
        isColumnPropModified(
          storedColumn,
          { colOptions: { options: [] } },
          'colOptions',
        ),
      ).toBe(true);
      // even when structurally identical — no cheap comparison is trustworthy
      // across the shapes clients send
      expect(isColumnPropModified(storedColumn, { meta: { x: 1 } }, 'meta')).toBe(
        true,
      );
    });
  });

  describe('payloadModifiesColumn', () => {
    const metaOnly = new Set(['description', 'meta']);

    it('does not flag the payload from the issue report', () => {
      // PATCH {column_name: <current>, title: <current>, description: 'hello'}
      // on a primary key column used to return 422.
      expect(
        payloadModifiesColumn(
          storedColumn,
          {
            column_name: storedColumn.column_name,
            title: storedColumn.title,
            description: 'hello',
          },
          metaOnly,
        ),
      ).toBe(false);
    });

    it('does not flag meta-only payloads', () => {
      expect(
        payloadModifiesColumn(storedColumn, { description: 'hello' }, metaOnly),
      ).toBe(false);
      expect(
        payloadModifiesColumn(storedColumn, { meta: { a: 1 } }, metaOnly),
      ).toBe(false);
      expect(payloadModifiesColumn(storedColumn, {}, metaOnly)).toBe(false);
    });

    it('flags a real change, including one hidden among resubmitted values', () => {
      expect(
        payloadModifiesColumn(storedColumn, { title: 'New' }, metaOnly),
      ).toBe(true);
      expect(
        payloadModifiesColumn(
          storedColumn,
          {
            column_name: storedColumn.column_name,
            title: 'New',
            description: 'hello',
          },
          metaOnly,
        ),
      ).toBe(true);
    });
  });
});
