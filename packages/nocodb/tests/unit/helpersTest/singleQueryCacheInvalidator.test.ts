import { expect } from 'chai';
import 'mocha';
import sinon from 'sinon';
import type { NcContext } from '~/interface/config';
import type Column from '~/models/Column';
import {
  clearSingleQueryCacheForColumnReferences,
  clearSingleQueryCacheForReferencingModels,
  clearSingleQueryCacheForRenamedColumnReferences,
} from '~/helpers/singleQueryCacheInvalidator';
import View from '~/models/View';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

// These invalidator functions are pure metadata graph-walks: they read
// COL_RELATIONS / COL_LOOKUP / COL_ROLLUP / COLUMNS rows via `ncMeta.metaList2`
// and their only side effect is calling `View.clearSingleQueryCache(modelId)`
// once per model whose compiled single-query SQL embeds the renamed entity.
//
// So we test them in isolation — no DB. A fake `ncMeta` serves canned rows
// (filtered by a tiny xcCondition evaluator that understands exactly the query
// shapes the file builds), `Noco.isEE` is forced true, and the cleared model
// ids are read off the `View.clearSingleQueryCache` spy. This exercises the
// real transitive-closure logic, which is the part worth guarding.

type Row = Record<string, any>;

type MetaStore = Partial<Record<string, Row[]>>;

/**
 * Minimal evaluator for the `xcCondition` shapes this file uses:
 * `_and` (all match), `_or` (some match), and leaf `{ field: { eq|neq|in } }`.
 */
function matchCondition(row: Row, cond: any): boolean {
  if (!cond) return true;
  if (cond._and) return cond._and.every((c: any) => matchCondition(row, c));
  if (cond._or) return cond._or.some((c: any) => matchCondition(row, c));

  return Object.entries(cond).every(([field, ops]: [string, any]) => {
    if (field === '_and' || field === '_or' || field === '_not') return true;
    return Object.entries(ops as Record<string, any>).every(([op, val]) => {
      const cell = row[field];
      switch (op) {
        case 'eq':
          return cell === val;
        case 'neq':
          return cell !== val;
        case 'in':
          return Array.isArray(val) && val.includes(cell);
        default:
          return false;
      }
    });
  });
}

/**
 * Fake `ncMeta` backed by an in-memory store. Returns the rows for `target`,
 * filtered by `xcCondition` when present (no condition → all rows). Records
 * every queried table so tests can assert the CE short-circuit issued none.
 */
function buildFakeNcMeta(store: MetaStore) {
  const queriedTables: string[] = [];

  const ncMeta = {
    metaList2: async (
      _workspaceId: string,
      _baseId: string,
      target: string,
      args?: { xcCondition?: any },
    ): Promise<Row[]> => {
      queriedTables.push(target);
      const rows = store[target] ?? [];
      return args?.xcCondition
        ? rows.filter((r) => matchCondition(r, args.xcCondition))
        : rows.slice();
    },
  } as unknown as typeof Noco.ncMeta;

  return { ncMeta, queriedTables };
}

function asColumn(partial: Partial<Column>): Column {
  return partial as unknown as Column;
}

const context: NcContext = { workspace_id: 'ws1', base_id: 'base1' };

export function singleQueryCacheInvalidatorTest() {
  describe('singleQueryCacheInvalidator', () => {
    let isEEStub: sinon.SinonStub;
    let clearStub: sinon.SinonStub;

    beforeEach(() => {
      isEEStub = sinon.stub(Noco, 'isEE').returns(true);
      clearStub = sinon
        .stub(View, 'clearSingleQueryCache')
        .resolves(undefined as any);
    });

    afterEach(() => {
      sinon.restore();
    });

    /** Sorted model ids passed to View.clearSingleQueryCache (its 2nd arg). */
    function clearedModelIds(): string[] {
      return clearStub
        .getCalls()
        .map((call) => call.args[1] as string)
        .sort();
    }

    describe('clearSingleQueryCacheForReferencingModels (table rename)', () => {
      it('clears direct + transitive (lookup/rollup chain) referrers, never the renamed model or unrelated ones', async () => {
        // Renaming table D. B links to D directly; C looks up B's link col;
        // E looks up C's lookup (2-hop); F rolls up C's lookup. G/A are
        // unrelated. Expected cleared: B, C, E, F.
        const { ncMeta } = buildFakeNcMeta({
          [MetaTable.COL_RELATIONS]: [
            { fk_column_id: 'rel_B_D', fk_related_model_id: 'D' },
            { fk_column_id: 'rel_G_A', fk_related_model_id: 'A' },
          ],
          [MetaTable.COL_LOOKUP]: [
            {
              fk_column_id: 'lk_C',
              fk_relation_column_id: 'rel_C_B',
              fk_lookup_column_id: 'rel_B_D',
            },
            {
              fk_column_id: 'lk_E',
              fk_relation_column_id: 'rel_E_C',
              fk_lookup_column_id: 'lk_C',
            },
            {
              fk_column_id: 'lk_G',
              fk_relation_column_id: 'rel_G_A',
              fk_lookup_column_id: 'title_A',
            },
          ],
          [MetaTable.COL_ROLLUP]: [
            {
              fk_column_id: 'rl_F',
              fk_relation_column_id: 'rel_F_C',
              fk_rollup_column_id: 'lk_C',
            },
          ],
          [MetaTable.COLUMNS]: [
            { id: 'rel_B_D', fk_model_id: 'B' },
            { id: 'lk_C', fk_model_id: 'C' },
            { id: 'lk_E', fk_model_id: 'E' },
            { id: 'rl_F', fk_model_id: 'F' },
          ],
        });

        await clearSingleQueryCacheForReferencingModels(context, 'D', ncMeta);

        expect(clearedModelIds()).to.deep.equal(['B', 'C', 'E', 'F']);
      });

      it('clears nothing when no model references the renamed table', async () => {
        const { ncMeta } = buildFakeNcMeta({
          [MetaTable.COL_RELATIONS]: [
            { fk_column_id: 'rel_G_A', fk_related_model_id: 'A' },
          ],
          [MetaTable.COL_LOOKUP]: [],
          [MetaTable.COL_ROLLUP]: [],
        });

        await clearSingleQueryCacheForReferencingModels(context, 'D', ncMeta);

        expect(clearStub.called).to.equal(false);
      });
    });

    describe('clearSingleQueryCacheForRenamedColumnReferences (column rename)', () => {
      it('clears FK far-side + transitive lookup/rollup referrers, excluding the column’s own model', async () => {
        // Renaming physical column col_X on model M. N is the far side of a
        // relation whose FK is col_X. P looks up col_X; Q looks up P’s
        // lookup (transitive); R rolls up col_X. Expected: N, P, Q, R.
        const { ncMeta } = buildFakeNcMeta({
          [MetaTable.COL_RELATIONS]: [
            { fk_child_column_id: 'col_X', fk_related_model_id: 'N' },
            { fk_parent_column_id: 'col_X', fk_related_model_id: 'M' }, // self → excluded
            { fk_column_id: 'rel_other', fk_related_model_id: 'Z' }, // unrelated
          ],
          [MetaTable.COL_LOOKUP]: [
            {
              fk_column_id: 'lk1',
              fk_relation_column_id: 'rel_P_M',
              fk_lookup_column_id: 'col_X',
            },
            {
              fk_column_id: 'lk2',
              fk_relation_column_id: 'rel_Q_P',
              fk_lookup_column_id: 'lk1',
            },
          ],
          [MetaTable.COL_ROLLUP]: [
            {
              fk_column_id: 'rl1',
              fk_relation_column_id: 'rel_R_M',
              fk_rollup_column_id: 'col_X',
            },
          ],
          [MetaTable.COLUMNS]: [
            { id: 'col_X', fk_model_id: 'M' },
            { id: 'lk1', fk_model_id: 'P' },
            { id: 'lk2', fk_model_id: 'Q' },
            { id: 'rl1', fk_model_id: 'R' },
          ],
        });

        await clearSingleQueryCacheForRenamedColumnReferences(
          context,
          asColumn({ id: 'col_X', fk_model_id: 'M', pv: false }),
          ncMeta,
        );

        expect(clearedModelIds()).to.deep.equal(['N', 'P', 'Q', 'R']);
      });

      it('includes Link referrers when the renamed column is the display value (pv)', async () => {
        // pk_M is the display value of M; S links to M and surfaces it.
        const store: MetaStore = {
          [MetaTable.COL_RELATIONS]: [
            { fk_column_id: 'rel_S_M', fk_related_model_id: 'M' },
          ],
          [MetaTable.COL_LOOKUP]: [],
          [MetaTable.COL_ROLLUP]: [],
          [MetaTable.COLUMNS]: [
            { id: 'pk_M', fk_model_id: 'M' },
            { id: 'rel_S_M', fk_model_id: 'S' },
          ],
        };

        const { ncMeta } = buildFakeNcMeta(store);
        await clearSingleQueryCacheForRenamedColumnReferences(
          context,
          asColumn({ id: 'pk_M', fk_model_id: 'M', pv: true }),
          ncMeta,
        );

        expect(clearedModelIds()).to.deep.equal(['S']);
      });

      it('excludes Link referrers when the renamed column is NOT the display value', async () => {
        const store: MetaStore = {
          [MetaTable.COL_RELATIONS]: [
            { fk_column_id: 'rel_S_M', fk_related_model_id: 'M' },
          ],
          [MetaTable.COL_LOOKUP]: [],
          [MetaTable.COL_ROLLUP]: [],
          [MetaTable.COLUMNS]: [
            { id: 'pk_M', fk_model_id: 'M' },
            { id: 'rel_S_M', fk_model_id: 'S' },
          ],
        };

        const { ncMeta } = buildFakeNcMeta(store);
        await clearSingleQueryCacheForRenamedColumnReferences(
          context,
          asColumn({ id: 'pk_M', fk_model_id: 'M', pv: false }),
          ncMeta,
        );

        // Only pk_M resolves → model M → removed as self → nothing cleared.
        expect(clearStub.called).to.equal(false);
      });
    });

    describe('clearSingleQueryCacheForColumnReferences (non-rename, one-hop)', () => {
      it('reaches only direct referrers — does NOT traverse a lookup-of-lookup chain', async () => {
        // col_X on M. N is FK far side. P looks up col_X directly. Q looks up
        // P’s lookup (lk1) — must NOT be reached (one-hop). R rolls up
        // col_X directly. Expected: N, P, R (no Q).
        const { ncMeta } = buildFakeNcMeta({
          [MetaTable.COL_RELATIONS]: [
            { fk_child_column_id: 'col_X', fk_related_model_id: 'N' },
          ],
          [MetaTable.COL_LOOKUP]: [
            {
              fk_column_id: 'lk1',
              fk_relation_column_id: 'rel_P_M',
              fk_lookup_column_id: 'col_X',
            },
            {
              fk_column_id: 'lk2',
              fk_relation_column_id: 'rel_Q_P',
              fk_lookup_column_id: 'lk1',
            },
          ],
          [MetaTable.COL_ROLLUP]: [
            {
              fk_column_id: 'rl1',
              fk_relation_column_id: 'rel_R_M',
              fk_rollup_column_id: 'col_X',
            },
          ],
          [MetaTable.COLUMNS]: [
            { id: 'rel_P_M', fk_model_id: 'P' },
            { id: 'rel_Q_P', fk_model_id: 'Q' },
            { id: 'rel_R_M', fk_model_id: 'R' },
          ],
        });

        await clearSingleQueryCacheForColumnReferences(
          context,
          asColumn({ id: 'col_X', fk_model_id: 'M', pv: false }),
          ncMeta,
        );

        expect(clearedModelIds()).to.deep.equal(['N', 'P', 'R']);
      });

      it('includes Link referrers when the column is the display value (pv)', async () => {
        const { ncMeta } = buildFakeNcMeta({
          [MetaTable.COL_RELATIONS]: [
            { fk_column_id: 'rel_S_M', fk_related_model_id: 'M' },
          ],
          [MetaTable.COL_LOOKUP]: [],
          [MetaTable.COL_ROLLUP]: [],
          [MetaTable.COLUMNS]: [{ id: 'rel_S_M', fk_model_id: 'S' }],
        });

        await clearSingleQueryCacheForColumnReferences(
          context,
          asColumn({ id: 'pk_M', fk_model_id: 'M', pv: true }),
          ncMeta,
        );

        expect(clearedModelIds()).to.deep.equal(['S']);
      });
    });

    describe('CE / unlicensed short-circuit', () => {
      it('issues no discovery queries and clears no cache when Noco.isEE() is false', async () => {
        isEEStub.returns(false);

        const { ncMeta, queriedTables } = buildFakeNcMeta({
          [MetaTable.COL_RELATIONS]: [
            { fk_column_id: 'rel_B_D', fk_related_model_id: 'D' },
          ],
          [MetaTable.COL_LOOKUP]: [],
          [MetaTable.COL_ROLLUP]: [],
          [MetaTable.COLUMNS]: [{ id: 'rel_B_D', fk_model_id: 'B' }],
        });

        const oldCol = asColumn({ id: 'col_X', fk_model_id: 'M', pv: true });

        await clearSingleQueryCacheForReferencingModels(context, 'D', ncMeta);
        await clearSingleQueryCacheForRenamedColumnReferences(
          context,
          oldCol,
          ncMeta,
        );
        await clearSingleQueryCacheForColumnReferences(context, oldCol, ncMeta);

        expect(queriedTables).to.deep.equal([]); // no metaList2 work
        expect(clearStub.called).to.equal(false); // no cache cleared
      });
    });
  });
}
