import 'mocha';
import { expect } from 'chai';
import { deepUnwrapLkv, flattenNestedLookup } from '~/db/mssql-lookup-flatten';

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

  // Regression for the depth-≥2 `_lkv` leak: a Lookup on a field-expanded linked
  // record (`nested[Link][fields]=…`) arrives wrapped inside the child record
  // and the top-level sweep never reaches it. deepUnwrapLkv strips the sentinel
  // wherever it sits in the nested structure.
  describe('deepUnwrapLkv — strips _lkv from nested child records', () => {
    it('child record with a SCALAR lookup field', () => {
      // C → [A]; A has a scalar Lookup `BLk` → `{_lkv:v}` inside the child.
      const input = [
        { Id: 1, ATitle: 'a-1', BLk: { _lkv: 'beta-1' } },
        { Id: 2, ATitle: 'a-2', BLk: { _lkv: null } },
      ];
      expect(deepUnwrapLkv(input)).to.deep.equal([
        { Id: 1, ATitle: 'a-1', BLk: 'beta-1' },
        { Id: 2, ATitle: 'a-2', BLk: null },
      ]);
    });

    it('child record with an ARRAY (multi) lookup field', () => {
      const input = [
        { Id: 1, ATitle: 'a-1', BLk: [{ _lkv: 'beta-1' }, { _lkv: 'beta-2' }] },
        { Id: 2, ATitle: 'a-2', BLk: [{ _lkv: 'beta-3' }] },
      ];
      expect(deepUnwrapLkv(input)).to.deep.equal([
        { Id: 1, ATitle: 'a-1', BLk: ['beta-1', 'beta-2'] },
        { Id: 2, ATitle: 'a-2', BLk: ['beta-3'] },
      ]);
    });

    it('single (BT/OO) child object, not an array', () => {
      expect(
        deepUnwrapLkv({ Id: 1, Title: 'x', Lk: { _lkv: 7 } }),
      ).to.deep.equal({ Id: 1, Title: 'x', Lk: 7 });
    });

    it('grandchild lookup (depth 3) is unwrapped too', () => {
      // C → [A]; A → [B]; B has a scalar lookup `CLk`.
      const input = [
        {
          Id: 1,
          As: [{ Id: 10, Bs: [{ Id: 100, CLk: { _lkv: 'deep' } }] }],
        },
      ];
      expect(deepUnwrapLkv(input)).to.deep.equal([
        { Id: 1, As: [{ Id: 10, Bs: [{ Id: 100, CLk: 'deep' }] }] },
      ]);
    });

    it('no-op when there is no _lkv (default pk+pv expansion)', () => {
      const input = [{ Id: 1, ATitle: 'a-1', As: [{ Id: 10, Title: 'x' }] }];
      expect(deepUnwrapLkv(input)).to.deep.equal([
        { Id: 1, ATitle: 'a-1', As: [{ Id: 10, Title: 'x' }] },
      ]);
    });

    it('passes scalars / null / empty through unchanged', () => {
      expect(deepUnwrapLkv(null)).to.equal(null);
      expect(deepUnwrapLkv('plain')).to.equal('plain');
      expect(deepUnwrapLkv(42)).to.equal(42);
      expect(deepUnwrapLkv([])).to.deep.equal([]);
    });
  });
}

export function mssqlLookupFlattenTest() {
  mssqlLookupFlattenTests();
}
