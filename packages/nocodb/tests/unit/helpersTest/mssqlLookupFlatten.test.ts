import 'mocha';
import { expect } from 'chai';
import { flattenNestedLookup } from '~/db/mssql-lookup-flatten';

// MSSQL's FOR JSON extract wraps each related row's looked-up value in an
// `{_lkv:…}` sentinel. When the looked-up column is itself array-shaped
// (LTAR-multi / lookup-through-multi) the payload nests one `{_lkv:[…]}` level
// per multi-hop. pg flattens every hop (json_array_elements), so its on-wire
// shape is always a single flat array. flattenNestedLookup mirrors that.
//
// The fixtures below are the EXACT raw JSON strings SQL Server returned for a
// self-referential MM `Features` table (verified live), so this guards the
// real wire shape, not a hand-built approximation.

function mssqlLookupFlattenTests() {
  describe('flattenNestedLookup — collapses nested MSSQL lookup payloads to pg shape', () => {
    it('lookup-of-LTAR (objects): flattens + drops empty related sets', () => {
      // `Features (from Features)` — lookup of the MM `Features` link.
      const raw =
        '[{"_lkv":[{"cefexh9y7vn5606":1,"cls7xfblrd91luy":"a"},{"cefexh9y7vn5606":2,"cls7xfblrd91luy":"b"},{"cefexh9y7vn5606":10,"cls7xfblrd91luy":"a"}]},{"_lkv":[{"cefexh9y7vn5606":2,"cls7xfblrd91luy":"b"}]},{"_lkv":null}]';

      // LTAR leaf objects are kept intact (col-ids mapped later by
      // substituteColumnIdsWithColumnTitles); the `{_lkv:null}` empty set drops.
      expect(flattenNestedLookup(JSON.parse(raw))).to.deep.equal([
        { cefexh9y7vn5606: 1, cls7xfblrd91luy: 'a' },
        { cefexh9y7vn5606: 2, cls7xfblrd91luy: 'b' },
        { cefexh9y7vn5606: 10, cls7xfblrd91luy: 'a' },
        { cefexh9y7vn5606: 2, cls7xfblrd91luy: 'b' },
      ]);
    });

    it('lookup-of-lookup (scalars): flattens nested _lkv to a flat value array', () => {
      // `Title (from Features) (from Features)` — _lkv-wrapped at both levels.
      const raw =
        '[{"_lkv":[{"_lkv":"a"},{"_lkv":"b"},{"_lkv":"a"}]},{"_lkv":[{"_lkv":"b"}]},{"_lkv":null}]';

      expect(flattenNestedLookup(JSON.parse(raw))).to.deep.equal([
        'a',
        'b',
        'a',
        'b',
      ]);
    });

    it('keeps leaf-level nulls but drops intermediate empty sets', () => {
      // A null scalar value sits at a leaf level → kept; an empty related set
      // ({_lkv:null} among array-wrappers) is intermediate → dropped.
      const raw = '[{"_lkv":[{"_lkv":"a"},{"_lkv":null}]},{"_lkv":null}]';

      expect(flattenNestedLookup(JSON.parse(raw))).to.deep.equal(['a', null]);
    });

    it('returns [] for an empty outer array', () => {
      expect(flattenNestedLookup([])).to.deep.equal([]);
    });

    it('handles deeper (triple) nesting in a single pass', () => {
      const raw =
        '[{"_lkv":[{"_lkv":[{"_lkv":"a"},{"_lkv":"b"}]},{"_lkv":null}]},{"_lkv":null}]';

      expect(flattenNestedLookup(JSON.parse(raw))).to.deep.equal(['a', 'b']);
    });
  });
}

export function mssqlLookupFlattenTest() {
  mssqlLookupFlattenTests();
}
