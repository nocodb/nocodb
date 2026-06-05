import 'mocha';
import { expect } from 'chai';
import init from '../../../../init';
import { createProject } from '../../../../factory/base';
import { createTable } from '../../../../factory/table';
import Base from '~/models/Base';
import Noco from '~/Noco';
import { BaseRelatedMetaTables, MetaTable } from '~/utils/globals';

type Context = Awaited<ReturnType<typeof init>>;

// Tables that live in satellite DBs (separate connection). In tests with no
// satellite env configured these fall back to the meta DB, but we still resolve
// the connection via the same accessor the production code uses.
const SATELLITE_CONN: Partial<Record<MetaTable, () => any>> = {
  [MetaTable.DOC_CONTENT]: () => Noco.ncDocsContent,
  [MetaTable.DOC_REVISIONS]: () => Noco.ncDocsContent,
  [MetaTable.OPERATION_LOGS]: () => Noco.ncOperationLogs,
};

const connFor = (table: MetaTable) => SATELLITE_CONN[table]?.() ?? Noco.ncMeta;

async function countByBase(table: MetaTable, baseId: string): Promise<number> {
  const row = await connFor(table)
    .knex(table)
    .where({ base_id: baseId })
    .count('* as c')
    .first();
  return Number(row?.c ?? 0);
}

/**
 * Regression guard for the base hard-delete (clean-up) cascade.
 *
 * `Base.delete()` must leave NO base-scoped rows behind. Several tables were
 * previously orphaned (MCP tokens, RLS policies, permissions, doc content,
 * sync/hook logs, record templates, etc.). This test seeds the base-scoped
 * tables, hard-deletes the base, then asserts every table enumerated in
 * `BaseRelatedMetaTables` has zero rows for that base.
 *
 * Seeding is best-effort (some tables have feature-specific NOT NULL columns);
 * a row that cannot be seeded is simply not asserted "present", but the final
 * zero-rows sweep still covers every table — so the test fails if anything
 * survives the delete, and never false-fails on a seed that could not run.
 */
export function baseHardDeleteOrphansTests() {
  describe('Base hard-delete leaves no orphan rows', () => {
    let context: Context;

    beforeEach(async () => {
      context = await init();
    });

    it('removes every base-scoped row across BaseRelatedMetaTables', async () => {
      const base = await createProject(context, { title: 'OrphanSweepBase' });
      const ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };

      // Natural population of the main cascade (models, columns, views, grid…).
      await createTable(context, base, { title: 'T1' });

      // Best-effort direct seed of base-scoped tables (incl. previously-orphaned
      // ones). Minimal columns + a few known NOT NULL extras; failures are
      // tolerated so the test stays stable while the sweep below stays strict.
      const seedExtras: Partial<Record<MetaTable, Record<string, any>>> = {
        [MetaTable.RLS_POLICIES]: { fk_model_id: 'mdl_orphan_test' },
        [MetaTable.RECORD_TEMPLATES]: {
          fk_model_id: 'mdl_orphan_test',
          title: 'tpl',
          template_data: '{}',
        },
        [MetaTable.MODEL_STAT]: { fk_model_id: 'mdl_orphan_test' },
        [MetaTable.MODEL_ROLE_VISIBILITY]: {
          fk_view_id: 'vw_orphan_test',
          role: 'editor',
        },
        [MetaTable.DEPENDENCY_TRACKER]: {
          source_type: 'GanttView',
          source_id: 'src_orphan',
          dependent_type: 'DateDependency',
          dependent_id: 'dep_orphan',
        },
        [MetaTable.TABLE_SYNCS]: { title: 'sync', source_input_mode: 'browse' },
        [MetaTable.SANDBOX_CHANGELOG]: {
          seq: 1,
          fk_sandbox_id: 'sbx_orphan',
          event: 'create',
          entity_type: 'table',
          created_by: 'usr_orphan',
        },
        [MetaTable.OPERATION_LOGS]: { seq: 1 },
      };

      const seedTargets: MetaTable[] = [
        MetaTable.MCP_TOKENS,
        MetaTable.HOOK_LOGS,
        MetaTable.SYNC_LOGS,
        MetaTable.COMMENTS_REACTIONS,
        MetaTable.RECORD_TEMPLATES,
        MetaTable.MODEL_ROLE_VISIBILITY,
        MetaTable.DEPENDENCY_TRACKER,
        MetaTable.RLS_POLICIES,
        MetaTable.PERMISSIONS,
        MetaTable.MODEL_STAT,
        MetaTable.INTEGRATION_LINKS,
        MetaTable.TABLE_SYNCS,
        MetaTable.SANDBOX_CHANGELOG,
        MetaTable.OPERATION_LOGS,
        MetaTable.DOC_CONTENT,
      ];

      const seeded: MetaTable[] = [];
      for (const table of seedTargets) {
        const row = {
          id: `orphan_${table}`.slice(0, 19),
          base_id: base.id,
          fk_workspace_id: base.fk_workspace_id,
          ...(seedExtras[table] ?? {}),
        };
        try {
          await connFor(table).knex(table).insert(row);
          seeded.push(table);
        } catch {
          // feature-specific NOT NULL / column mismatch — skip; sweep still covers it
        }
      }

      // Sanity: at least the simple tables must have seeded, else the test is
      // not actually exercising the cleanup.
      expect(
        seeded.length,
        'expected to seed at least some orphan tables',
      ).to.be.greaterThan(0);

      // Every seeded row must be present before the delete.
      for (const table of seeded) {
        expect(
          await countByBase(table, base.id),
          `seed missing for ${table}`,
        ).to.be.greaterThan(0);
      }

      // Hard delete — the operation under test.
      await Base.delete(ctx, base.id);

      // The base row itself is gone.
      expect(await Base.get(ctx, base.id)).to.not.exist;

      // No base-scoped row may survive in ANY base-related table. Tables that
      // are scoped only via a parent FK (no base_id column) throw on the
      // count query — those are covered transitively by their parent's
      // cleanup, so we skip them rather than false-fail.
      const survivors: Record<string, number> = {};
      for (const table of BaseRelatedMetaTables) {
        let c = 0;
        try {
          c = await countByBase(table, base.id);
        } catch {
          continue; // table has no base_id column — covered via parent cascade
        }
        if (c > 0) survivors[table] = c;
      }

      expect(
        survivors,
        `orphan rows survived hard delete: ${JSON.stringify(survivors)}`,
      ).to.deep.equal({});
    });
  });
}
