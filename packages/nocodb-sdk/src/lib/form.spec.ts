import {
  FORM_ROW_FULL_WIDTH_UI_TYPES,
  FORM_ROW_MAX_FIELDS,
  groupFormColumnsByRow,
} from './form';
import UITypes from './UITypes';

describe('form helpers', () => {
  describe('groupFormColumnsByRow', () => {
    it('returns an empty array for empty input', () => {
      expect(groupFormColumnsByRow([])).toEqual([]);
    });

    it('puts each null-row_id column on its own row (legacy single-column)', () => {
      const cols = [
        { id: 'a', row_id: null, uidt: UITypes.SingleLineText },
        { id: 'b', row_id: null, uidt: UITypes.SingleLineText },
        { id: 'c', row_id: null, uidt: UITypes.SingleLineText },
      ];
      const rows = groupFormColumnsByRow(cols);
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.map((c) => c.id))).toEqual([
        ['a'],
        ['b'],
        ['c'],
      ]);
    });

    it('groups columns sharing a row_id into one row in input order', () => {
      const cols = [
        { id: 'a', row_id: 'fr_one', uidt: UITypes.SingleLineText },
        { id: 'b', row_id: 'fr_one', uidt: UITypes.SingleLineText },
        { id: 'c', row_id: 'fr_one', uidt: UITypes.SingleLineText },
      ];
      const rows = groupFormColumnsByRow(cols);
      expect(rows).toHaveLength(1);
      expect(rows[0].map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('handles a mix of grouped and solo rows, preserving order', () => {
      const cols = [
        { id: 'a', row_id: null, uidt: UITypes.SingleLineText },
        { id: 'b', row_id: 'fr_x', uidt: UITypes.SingleLineText },
        { id: 'c', row_id: 'fr_x', uidt: UITypes.SingleLineText },
        { id: 'd', row_id: null, uidt: UITypes.SingleLineText },
      ];
      const rows = groupFormColumnsByRow(cols);
      expect(rows.map((r) => r.map((c) => c.id))).toEqual([
        ['a'],
        ['b', 'c'],
        ['d'],
      ]);
    });

    it('promotes full-width uidt to its own row even when row_id is set', () => {
      const cols = [
        { id: 'a', row_id: 'fr_x', uidt: UITypes.SingleLineText },
        { id: 'b', row_id: 'fr_x', uidt: UITypes.LongText },
        { id: 'c', row_id: 'fr_x', uidt: UITypes.SingleLineText },
      ];
      const rows = groupFormColumnsByRow(cols);
      // LongText is always full-width, so it breaks the fr_x row into three.
      expect(rows.map((r) => r.map((c) => c.id))).toEqual([
        ['a'],
        ['b'],
        ['c'],
      ]);
    });

    it('splits non-contiguous same-row_id chunks into separate rows (visual order wins)', () => {
      // Well-behaved input is always sorted by `order`, so same-row_id
      // fields arrive together. If they're interleaved with other
      // row_ids, we still render in order instead of reshuffling.
      const cols = [
        { id: 'a', row_id: 'fr_two', uidt: UITypes.SingleLineText },
        { id: 'b', row_id: 'fr_one', uidt: UITypes.SingleLineText },
        { id: 'c', row_id: 'fr_two', uidt: UITypes.SingleLineText },
        { id: 'd', row_id: 'fr_one', uidt: UITypes.SingleLineText },
      ];
      const rows = groupFormColumnsByRow(cols);
      expect(rows.map((r) => r.map((c) => c.id))).toEqual([
        ['a'],
        ['b'],
        ['c'],
        ['d'],
      ]);
    });

    it('treats Attachment and JSON as full-width, same as LongText', () => {
      const cols = [
        { id: 'a', row_id: 'fr_x', uidt: UITypes.SingleLineText },
        { id: 'b', row_id: 'fr_x', uidt: UITypes.Attachment },
        { id: 'c', row_id: 'fr_x', uidt: UITypes.JSON },
      ];
      const rows = groupFormColumnsByRow(cols);
      expect(rows).toHaveLength(3);
    });
  });

  describe('constants', () => {
    it('FORM_ROW_MAX_FIELDS is 5', () => {
      expect(FORM_ROW_MAX_FIELDS).toBe(5);
    });

    it('FORM_ROW_FULL_WIDTH_UI_TYPES covers LongText / Attachment / JSON', () => {
      expect(FORM_ROW_FULL_WIDTH_UI_TYPES).toContain(UITypes.LongText);
      expect(FORM_ROW_FULL_WIDTH_UI_TYPES).toContain(UITypes.Attachment);
      expect(FORM_ROW_FULL_WIDTH_UI_TYPES).toContain(UITypes.JSON);
    });
  });
});
