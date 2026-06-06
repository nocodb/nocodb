import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import init from '~test/init';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createColumn } from '~test/factory/column';
import Noco from '~/Noco';
import { Base } from '~/models';
import { MetaTable } from '~/utils/globals';

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
  });
}
