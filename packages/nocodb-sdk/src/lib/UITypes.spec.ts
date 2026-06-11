import { RelationTypes } from './globals';
import UITypes, {
  isBtLikeV2Junction,
  isLinksOrLTAR,
  isLinkV2,
  isMMOrMMLike,
} from './UITypes';

// Helper to create a column-like object with colOptions
function makeCol(
  uidt: UITypes,
  type: string,
  version: number | string | undefined
) {
  return {
    uidt,
    colOptions: { type, version },
  };
}

describe('UITypes — V2 LTAR helpers', () => {
  // ==========================================================================
  // isLinkV2 — detects V2 junction-table-based links
  // ==========================================================================
  describe('isLinkV2', () => {
    it('returns true for V2 with numeric version', () => {
      expect(isLinkV2(makeCol(UITypes.LinkToAnotherRecord, 'oo', 2))).toBe(
        true
      );
    });

    it('returns true for V2 with string version (DB stores as string)', () => {
      expect(isLinkV2(makeCol(UITypes.LinkToAnotherRecord, 'oo', '2'))).toBe(
        true
      );
    });

    it('returns true for UITypes.Links with string version', () => {
      expect(isLinkV2(makeCol(UITypes.Links, 'mm', '2'))).toBe(true);
    });

    it.each(['mo', 'om', 'mm', 'oo', 'bt', 'hm'])(
      'returns true for V2 type=%s regardless of relation type',
      (type) => {
        expect(isLinkV2(makeCol(UITypes.LinkToAnotherRecord, type, 2))).toBe(
          true
        );
        expect(isLinkV2(makeCol(UITypes.LinkToAnotherRecord, type, '2'))).toBe(
          true
        );
      }
    );

    it('returns false for V1 (version=1)', () => {
      expect(isLinkV2(makeCol(UITypes.LinkToAnotherRecord, 'hm', 1))).toBe(
        false
      );
    });

    it('returns false for V1 with string version', () => {
      expect(isLinkV2(makeCol(UITypes.LinkToAnotherRecord, 'hm', '1'))).toBe(
        false
      );
    });

    it('returns false for undefined version', () => {
      expect(
        isLinkV2(makeCol(UITypes.LinkToAnotherRecord, 'hm', undefined))
      ).toBe(false);
    });

    it('returns false for non-LTAR column', () => {
      expect(isLinkV2(makeCol(UITypes.SingleLineText, 'oo', 2))).toBe(false);
    });

    it('returns false when colOptions not loaded', () => {
      expect(isLinkV2({ uidt: UITypes.LinkToAnotherRecord })).toBe(false);
    });

    it('returns false for string/primitive input', () => {
      expect(isLinkV2(UITypes.LinkToAnotherRecord)).toBe(false);
      expect(isLinkV2('LinkToAnotherRecord')).toBe(false);
    });
  });

  // ==========================================================================
  // isMMOrMMLike — true for V2 (junction-table) OR V1 MM
  // This drives routing: MM-like columns use junction table paths for
  // data loading, link/unlink, nested insert, excluded lists, etc.
  // ==========================================================================
  describe('isMMOrMMLike', () => {
    describe('V2 columns (all junction-table based → all return true)', () => {
      it.each(['mo', 'om', 'mm', 'oo', 'bt'])(
        'returns true for V2 type=%s with numeric version',
        (type) => {
          expect(
            isMMOrMMLike(makeCol(UITypes.LinkToAnotherRecord, type, 2))
          ).toBe(true);
        }
      );

      it.each(['mo', 'om', 'mm', 'oo', 'bt'])(
        'returns true for V2 type=%s with string version from DB',
        (type) => {
          expect(
            isMMOrMMLike(makeCol(UITypes.LinkToAnotherRecord, type, '2'))
          ).toBe(true);
        }
      );

      it('returns true for UITypes.Links V2', () => {
        expect(isMMOrMMLike(makeCol(UITypes.Links, 'mm', '2'))).toBe(true);
        expect(isMMOrMMLike(makeCol(UITypes.Links, 'mo', '2'))).toBe(true);
      });
    });

    describe('V1 columns', () => {
      it('returns true for V1 MM (traditional many-to-many)', () => {
        expect(
          isMMOrMMLike(
            makeCol(UITypes.LinkToAnotherRecord, RelationTypes.MANY_TO_MANY, 1)
          )
        ).toBe(true);
        expect(
          isMMOrMMLike(makeCol(UITypes.LinkToAnotherRecord, 'mm', '1'))
        ).toBe(true);
      });

      it.each(['hm', 'bt', 'oo'])(
        'returns false for V1 type=%s (FK-based)',
        (type) => {
          expect(
            isMMOrMMLike(makeCol(UITypes.LinkToAnotherRecord, type, 1))
          ).toBe(false);
          expect(
            isMMOrMMLike(makeCol(UITypes.LinkToAnotherRecord, type, '1'))
          ).toBe(false);
        }
      );
    });

    it('returns false when colOptions not loaded', () => {
      expect(isMMOrMMLike({ uidt: UITypes.LinkToAnotherRecord })).toBe(false);
    });

    it('returns false for non-LTAR column', () => {
      expect(isMMOrMMLike(makeCol(UITypes.SingleLineText, 'mm', 2))).toBe(
        false
      );
    });
  });

  // ==========================================================================
  // isBtLikeV2Junction — true for V2 single-record types (MO, OO, BT)
  // These use junction tables but return ONE record, not an array.
  // Drives: BelongsTo.vue rendering, single-record data loading, mmRead
  // ==========================================================================
  describe('isBtLikeV2Junction', () => {
    describe('single-record V2 types → true', () => {
      it.each(['mo', 'oo', 'bt'])(
        'returns true for V2 type=%s with numeric version',
        (type) => {
          expect(
            isBtLikeV2Junction(makeCol(UITypes.LinkToAnotherRecord, type, 2))
          ).toBe(true);
        }
      );

      it.each(['mo', 'oo', 'bt'])(
        'returns true for V2 type=%s with string version from DB',
        (type) => {
          expect(
            isBtLikeV2Junction(makeCol(UITypes.LinkToAnotherRecord, type, '2'))
          ).toBe(true);
        }
      );

      it('returns true for UITypes.Links V2 MO', () => {
        expect(isBtLikeV2Junction(makeCol(UITypes.Links, 'mo', '2'))).toBe(
          true
        );
      });
    });

    describe('multi-record V2 types → false', () => {
      it.each(['mm', 'om'])(
        'returns false for V2 type=%s (multi-record)',
        (type) => {
          expect(
            isBtLikeV2Junction(makeCol(UITypes.LinkToAnotherRecord, type, '2'))
          ).toBe(false);
          expect(
            isBtLikeV2Junction(makeCol(UITypes.LinkToAnotherRecord, type, 2))
          ).toBe(false);
        }
      );
    });

    describe('V1 types → always false (no junction table)', () => {
      it.each(['bt', 'oo', 'hm', 'mm'])(
        'returns false for V1 type=%s',
        (type) => {
          expect(
            isBtLikeV2Junction(makeCol(UITypes.LinkToAnotherRecord, type, 1))
          ).toBe(false);
          expect(
            isBtLikeV2Junction(makeCol(UITypes.LinkToAnotherRecord, type, '1'))
          ).toBe(false);
        }
      );
    });

    it('returns false when colOptions not loaded', () => {
      expect(isBtLikeV2Junction({ uidt: UITypes.LinkToAnotherRecord })).toBe(
        false
      );
    });

    it('returns false for non-LTAR column', () => {
      expect(isBtLikeV2Junction(makeCol(UITypes.SingleLineText, 'mo', 2))).toBe(
        false
      );
    });
  });

  // ==========================================================================
  // isLinksOrLTAR — basic uidt check
  // ==========================================================================
  describe('isLinksOrLTAR', () => {
    it('returns true for LinkToAnotherRecord', () => {
      expect(isLinksOrLTAR({ uidt: UITypes.LinkToAnotherRecord })).toBe(true);
    });

    it('returns true for Links', () => {
      expect(isLinksOrLTAR({ uidt: UITypes.Links })).toBe(true);
    });

    it('returns false for other types', () => {
      expect(isLinksOrLTAR({ uidt: UITypes.SingleLineText })).toBe(false);
      expect(isLinksOrLTAR({ uidt: UITypes.Rollup })).toBe(false);
    });
  });

  // ==========================================================================
  // Cross-function consistency — same column should produce consistent results
  // across all three helpers (prevents routing bugs)
  // ==========================================================================
  describe('cross-function consistency', () => {
    it('V2 MO: isLinkV2=true, isMMOrMMLike=true, isBtLikeV2Junction=true', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'mo', '2');
      expect(isLinkV2(col)).toBe(true);
      expect(isMMOrMMLike(col)).toBe(true);
      expect(isBtLikeV2Junction(col)).toBe(true);
    });

    it('V2 OO: isLinkV2=true, isMMOrMMLike=true, isBtLikeV2Junction=true', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'oo', '2');
      expect(isLinkV2(col)).toBe(true);
      expect(isMMOrMMLike(col)).toBe(true);
      expect(isBtLikeV2Junction(col)).toBe(true);
    });

    it('V2 OM: isLinkV2=true, isMMOrMMLike=true, isBtLikeV2Junction=false', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'om', '2');
      expect(isLinkV2(col)).toBe(true);
      expect(isMMOrMMLike(col)).toBe(true);
      expect(isBtLikeV2Junction(col)).toBe(false);
    });

    it('V2 MM: isLinkV2=true, isMMOrMMLike=true, isBtLikeV2Junction=false', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'mm', '2');
      expect(isLinkV2(col)).toBe(true);
      expect(isMMOrMMLike(col)).toBe(true);
      expect(isBtLikeV2Junction(col)).toBe(false);
    });

    it('V1 HM: isLinkV2=false, isMMOrMMLike=false, isBtLikeV2Junction=false', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'hm', '1');
      expect(isLinkV2(col)).toBe(false);
      expect(isMMOrMMLike(col)).toBe(false);
      expect(isBtLikeV2Junction(col)).toBe(false);
    });

    it('V1 BT: isLinkV2=false, isMMOrMMLike=false, isBtLikeV2Junction=false', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'bt', '1');
      expect(isLinkV2(col)).toBe(false);
      expect(isMMOrMMLike(col)).toBe(false);
      expect(isBtLikeV2Junction(col)).toBe(false);
    });

    it('V1 MM: isLinkV2=false, isMMOrMMLike=true, isBtLikeV2Junction=false', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'mm', '1');
      expect(isLinkV2(col)).toBe(false);
      expect(isMMOrMMLike(col)).toBe(true);
      expect(isBtLikeV2Junction(col)).toBe(false);
    });

    it('V1 OO: isLinkV2=false, isMMOrMMLike=false, isBtLikeV2Junction=false', () => {
      const col = makeCol(UITypes.LinkToAnotherRecord, 'oo', '1');
      expect(isLinkV2(col)).toBe(false);
      expect(isMMOrMMLike(col)).toBe(false);
      expect(isBtLikeV2Junction(col)).toBe(false);
    });
  });
});
