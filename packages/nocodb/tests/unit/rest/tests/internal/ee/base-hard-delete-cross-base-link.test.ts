import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import { UITypes } from 'nocodb-sdk';
import init from '~test/init';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createColumn } from '~test/factory/column';
import Noco from '~/Noco';
import { Base, Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';

type Context = Awaited<ReturnType<typeof init>>;

// ── Internal API helpers (field trash lives on the internal controller) ──
async function internalGet(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string>,
) {
  return request(context.app)
    .get(`/api/v2/internal/${workspaceId}/${baseId}`)
    .query(query)
    .set('xc-token', context.xc_token);
}

async function internalPost(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string>,
  body: Record<string, any> = {},
) {
  return request(context.app)
    .post(`/api/v2/internal/${workspaceId}/${baseId}`)
    .query(query)
    .set('xc-token', context.xc_token)
    .send(body);
}

// The cross-base link's relation row lives in the OWNING base (base B) but
// references base A via fk_related_base_id — read it directly across bases.
function relationRowFor(columnId: string) {
  return Noco.ncMeta
    .knex(MetaTable.COL_RELATIONS)
    .where({ fk_column_id: columnId })
    .first();
}

export function baseHardDeleteCrossBaseLinkTests() {
  describe('Internal API - Base hard delete cleans up cross-base links', () => {
    let context: Context;
    // baseB owns the link column; baseA is the base it points into.
    let baseA: any;
    let baseB: any;
    let ctxA: { workspace_id: string; base_id: string };
    let ctxB: { workspace_id: string; base_id: string };
    let tableA: any;
    let tableB: any;

    beforeEach(async () => {
      context = await init();
      baseB = await createProject(context, { title: 'CrossLinkOwner' });
      baseA = await createProject(context, { title: 'CrossLinkTarget' });
      ctxA = { workspace_id: baseA.fk_workspace_id, base_id: baseA.id };
      ctxB = { workspace_id: baseB.fk_workspace_id, base_id: baseB.id };
      tableB = await createTable(context, baseB, {
        title: 'TB',
        table_name: 'tb',
      });
      tableA = await createTable(context, baseA, {
        title: 'TA',
        table_name: 'ta',
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    // Create a cross-base LTAR in base B pointing into base A.
    async function createCrossBaseLink(title = 'LinkToA') {
      const col = await createColumn(context, tableB, {
        title,
        column_name: title,
        uidt: UITypes.LinkToAnotherRecord,
        parentId: tableB.id,
        childId: tableA.id,
        ref_base_id: baseA.id,
        type: 'hm',
      });
      expect(col, 'cross-base link column should be created in base B').to.not
        .be.undefined;

      const rel = await relationRowFor(col.id);
      expect(rel, 'cross-base relation row should exist').to.not.be.undefined;
      expect(
        rel.fk_related_base_id,
        'link should reference base A as related base',
      ).to.eq(baseA.id);
      expect(rel.base_id, 'relation row should be owned by base B').to.eq(
        baseB.id,
      );

      return col;
    }

    it('removes an active cross-base link in base B when base A is hard-deleted', async () => {
      const link = await createCrossBaseLink();

      await Base.delete(ctxA, baseA.id);

      const rel = await relationRowFor(link.id);
      expect(rel, 'dangling cross-base relation row must be removed').to.be
        .undefined;

      const colRow = await Noco.ncMeta.metaGet2(
        ctxB.workspace_id,
        ctxB.base_id,
        MetaTable.COLUMNS,
        link.id,
      );
      expect(colRow, 'dangling cross-base link column must be removed').to.not
        .exist;
    });

    it('removes a trashed cross-base link + its trash entry; restore cannot resurrect it', async () => {
      const link = await createCrossBaseLink();

      // Soft-delete (field trash) the cross-base link in base B.
      const del = await internalPost(context, ctxB.workspace_id, ctxB.base_id, {
        operation: 'columnDelete',
        columnId: link.id,
      });
      expect(
        del.status,
        'soft-deleting the cross-base link should succeed',
      ).to.eq(200);

      // A trash entry now exists in base B.
      const listed = await internalGet(
        context,
        ctxB.workspace_id,
        ctxB.base_id,
        {
          operation: 'baseTrashList',
        },
      );
      const entry = (listed.body?.list || []).find(
        (t: any) => t.resource_id === link.id,
      );
      expect(entry, 'trash entry should exist after soft delete').to.not.be
        .undefined;

      // Hard-delete the target base A.
      await Base.delete(ctxA, baseA.id);

      // The dangling link column + relation row must be gone.
      const rel = await relationRowFor(link.id);
      expect(rel, 'dangling cross-base relation row must be removed').to.be
        .undefined;
      const colRow = await Noco.ncMeta.metaGet2(
        ctxB.workspace_id,
        ctxB.base_id,
        MetaTable.COLUMNS,
        link.id,
      );
      expect(colRow, 'dangling cross-base link column must be removed').to.not
        .exist;

      // The trash entry must be cleared so the link cannot be restored.
      const listed2 = await internalGet(
        context,
        ctxB.workspace_id,
        ctxB.base_id,
        { operation: 'baseTrashList' },
      );
      const entry2 = (listed2.body?.list || []).find(
        (t: any) => t.resource_id === link.id,
      );
      expect(
        entry2,
        'trash entry must be cleared after the target base is hard-deleted',
      ).to.be.undefined;

      // Even if the stale trash id is replayed, restore must not resurrect it.
      await internalPost(
        context,
        ctxB.workspace_id,
        ctxB.base_id,
        { operation: 'baseTrashRestore' },
        { trashId: entry.id },
      );
      const relAfterRestore = await relationRowFor(link.id);
      expect(
        relAfterRestore,
        'restore must not resurrect a cross-base link to a deleted base',
      ).to.be.undefined;
    });

    it('runs column-delete dependency cleanup in base B (lookup error-marked, filter removed)', async () => {
      const link = await createCrossBaseLink();

      // A Lookup in base B reading base A's Title through the cross-base link.
      const colsA = await tableA.getColumns(ctxA);
      const titleA = colsA.find((c: any) => c.title === 'Title');
      expect(titleA, 'table A should have a Title column').to.not.be.undefined;
      const lookup = await createColumn(context, tableB, {
        title: 'LookupTitleA',
        column_name: 'LookupTitleA',
        uidt: UITypes.Lookup,
        fk_relation_column_id: link.id,
        fk_lookup_column_id: titleA.id,
      });
      expect(lookup, 'lookup over the cross-base link should be created').to.not
        .be.undefined;

      // A filter on the link column in base B's default view.
      const views = await tableB.getViews(ctxB);
      const fCreate = await internalPost(
        context,
        ctxB.workspace_id,
        ctxB.base_id,
        { operation: 'filterCreate', viewId: views[0].id },
        {
          fk_column_id: link.id,
          comparison_op: 'blank',
          logical_op: 'and',
        },
      );
      expect(
        fCreate.status,
        `filter on the link column should be created: ${JSON.stringify(
          fCreate.body,
        )}`,
      ).to.eq(200);
      const filterId = fCreate.body.id;

      await Base.delete(ctxA, baseA.id);

      // The lookup column survives, error-marked by the dependency system.
      const lookupColRow = await Noco.ncMeta.metaGet2(
        ctxB.workspace_id,
        ctxB.base_id,
        MetaTable.COLUMNS,
        lookup.id,
      );
      expect(lookupColRow, 'dependent lookup column must survive error-marked')
        .to.exist;
      const lookupOpt = await Noco.ncMeta
        .knex(MetaTable.COL_LOOKUP)
        .where({ fk_column_id: lookup.id })
        .first();
      expect(lookupOpt, 'lookup col options must survive').to.exist;
      expect(
        lookupOpt.error,
        'dependent lookup must be error-marked when its relation link is removed',
      ).to.be.a('string').and.not.be.empty;

      // The filter on the removed link column must be swept.
      const filterRow = await Noco.ncMeta
        .knex(MetaTable.FILTER_EXP)
        .where({ id: filterId })
        .first();
      expect(
        filterRow,
        'filter referencing the removed cross-base link must be deleted',
      ).to.be.undefined;
    });

    it('tears down the auto-created junction in base B for a cross-base mm link', async () => {
      const link = await createColumn(context, tableB, {
        title: 'MMToA',
        column_name: 'MMToA',
        uidt: UITypes.Links,
        parentId: tableB.id,
        childId: tableA.id,
        ref_base_id: baseA.id,
        type: 'mm',
      });
      expect(link, 'cross-base mm link should be created').to.not.be.undefined;

      const rel = await relationRowFor(link.id);
      expect(rel?.fk_mm_model_id, 'mm link should have a junction model').to.not
        .be.undefined;
      expect(
        rel.fk_mm_base_id,
        'junction should live in the link-owning base',
      ).to.eq(baseB.id);

      const junction = await Model.get(ctxB, rel.fk_mm_model_id);
      expect(junction?.mm, 'junction should be auto-created (mm flag)').to.be
        .ok;

      const junctionSource = await Source.get(ctxB, junction.source_id);
      const sourceKnex = await NcConnectionMgrv2.get(junctionSource as any);
      // In reflection mode the junction lives in base B's per-base schema —
      // qualify the lookup the same way the cleanup qualifies the drop.
      const schema = (junctionSource as any).getConfig()?.schema;
      const junctionTableExists = () =>
        schema
          ? sourceKnex.schema.withSchema(schema).hasTable(junction.table_name)
          : sourceKnex.schema.hasTable(junction.table_name);
      expect(
        await junctionTableExists(),
        'junction table should exist physically before delete',
      ).to.eq(true);

      // System links on base B's table pointing at the junction.
      const systemLinksBefore = await Noco.ncMeta
        .knex(MetaTable.COL_RELATIONS)
        .where({ fk_related_model_id: junction.id, base_id: baseB.id });
      expect(
        systemLinksBefore.length,
        'a system link in base B should reference the junction',
      ).to.be.greaterThan(0);

      await Base.delete(ctxA, baseA.id);

      const relAfter = await relationRowFor(link.id);
      expect(relAfter, 'mm link relation row must be removed').to.be.undefined;

      const junctionRow = await Noco.ncMeta.metaGet2(
        ctxB.workspace_id,
        ctxB.base_id,
        MetaTable.MODELS,
        junction.id,
      );
      expect(junctionRow, 'orphaned junction model metadata must be removed').to
        .not.exist;

      expect(
        await junctionTableExists(),
        'orphaned physical junction table must be dropped',
      ).to.eq(false);

      const systemLinksAfter = await Noco.ncMeta
        .knex(MetaTable.COL_RELATIONS)
        .where({ fk_related_model_id: junction.id });
      expect(
        systemLinksAfter.length,
        'system links referencing the junction must be removed',
      ).to.eq(0);

      for (const sysLink of systemLinksBefore) {
        const sysColRow = await Noco.ncMeta.metaGet2(
          ctxB.workspace_id,
          ctxB.base_id,
          MetaTable.COLUMNS,
          sysLink.fk_column_id,
        );
        expect(
          sysColRow,
          'system link column referencing the junction must be removed',
        ).to.not.exist;
      }
    });

    it('completes the base delete when the physical junction drop fails (best-effort)', async () => {
      const link = await createColumn(context, tableB, {
        title: 'MMToAFail',
        column_name: 'MMToAFail',
        uidt: UITypes.Links,
        parentId: tableB.id,
        childId: tableA.id,
        ref_base_id: baseA.id,
        type: 'mm',
      });

      const rel = await relationRowFor(link.id);
      const junction = await Model.get(ctxB, rel.fk_mm_model_id);
      const junctionSource = await Source.get(ctxB, junction.source_id);

      // The physical junction drop runs on the workspace DB — a separate
      // connection that does NOT poison the meta transaction. A failure there
      // must be swallowed so the base delete still completes; only the
      // physical table is left orphaned, the metadata is still swept.
      const originalGet = NcConnectionMgrv2.get.bind(NcConnectionMgrv2);
      sinon.stub(NcConnectionMgrv2, 'get').callsFake(async (src: any) => {
        if (src?.id === junctionSource.id) {
          const reject = () =>
            Promise.reject(new Error('simulated junction drop failure'));
          return {
            schema: {
              withSchema: () => ({ dropTableIfExists: reject }),
              dropTableIfExists: reject,
            },
          } as any;
        }
        return originalGet(src);
      });

      let error: Error | null = null;
      try {
        await Base.delete(ctxA, baseA.id);
      } catch (e: any) {
        error = e;
      }
      expect(
        error,
        'a workspace-DB junction drop failure must not abort the base delete',
      ).to.be.null;

      // Metadata is still swept even though the physical drop was swallowed.
      const junctionRow = await Noco.ncMeta.metaGet2(
        ctxB.workspace_id,
        ctxB.base_id,
        MetaTable.MODELS,
        junction.id,
      );
      expect(
        junctionRow,
        'junction metadata must still be removed after a swallowed physical drop',
      ).to.not.exist;

      const relAfter = await relationRowFor(link.id);
      expect(relAfter, 'mm link relation row must still be removed').to.be
        .undefined;
    });

    it('leaves a trashed link trashed when the canonical delete fails', async () => {
      const link = await createCrossBaseLink();

      // Soft-delete (field trash) the cross-base link in base B.
      const del = await internalPost(context, ctxB.workspace_id, ctxB.base_id, {
        operation: 'columnDelete',
        columnId: link.id,
      });
      expect(del.status).to.eq(200);

      // Make the canonical delete fail for this column only.
      const originalDelete2 = Column.delete2.bind(Column);
      sinon
        .stub(Column, 'delete2')
        .callsFake((ctx: any, args: any, ncMeta?: any) => {
          if (args?.id === link.id) {
            throw new Error('simulated delete2 failure');
          }
          return originalDelete2(ctx, args, ncMeta);
        });

      // Best-effort outside a transaction: the base delete still completes.
      await Base.delete(ctxA, baseA.id);

      const colRow = await Noco.ncMeta.metaGet2(
        ctxB.workspace_id,
        ctxB.base_id,
        MetaTable.COLUMNS,
        link.id,
      );
      expect(colRow, 'column should still exist (its delete failed)').to.exist;
      expect(
        colRow.deleted,
        'a failed delete must not leave a trashed column re-activated',
      ).to.eq(true);
    });

    it('propagates cleanup failures when running inside a caller-owned transaction', async () => {
      await createCrossBaseLink();

      // A throwing dependency handler rolls back the shared transaction —
      // the cleanup must abort so the owner can roll back once, instead of
      // continuing to issue statements on a dead transaction.
      const handler = Noco.nestApp.get(MetaDependencyEventHandler);
      sinon
        .stub(handler, 'handleEvent')
        .rejects(new Error('simulated handler failure'));

      const trx = await Noco.ncMeta.startTransaction();
      let error: Error | null = null;
      try {
        await Base.delete(ctxA, baseA.id, trx);
      } catch (e: any) {
        error = e;
      } finally {
        await trx.rollback();
      }

      expect(
        error,
        'a dependency-pipeline failure inside a shared transaction must abort the delete',
      ).to.not.be.null;
    });
  });
}
