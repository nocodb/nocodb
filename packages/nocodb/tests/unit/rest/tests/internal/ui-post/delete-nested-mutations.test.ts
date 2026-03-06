import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const deleteNestedMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Delete & Nested Mutations (POST)', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'DeleteNestedBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Create table
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'DeleteNestedTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
          ],
        })
        .expect(200);

      // Get table model
      const source = (await initBase.getSources())[0];
      ctx = { base_id: initBase.id, workspace_id: workspaceId };
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: tableResult.body.id,
        base_id: initBase.id,
      });

      // Override feature flag
      featureMock = await overrideFeature({
        workspace_id: workspaceId,
        feature: PlanFeatureTypes.FEATURE_API_VIEW_V3,
        allowed: true,
      });

      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      // Get default view
      const viewListRes = await request(context.app)
        .get(INTERNAL_API_BASE)
        .query({ operation: 'viewList', tableId: table.id })
        .set('xc-token', context.xc_token)
        .expect(200);

      defaultViewId = viewListRes.body.list[0].id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── tableDelete ─────────────────────────────────────────────────

    describe('tableDelete (POST)', () => {
      it('should delete a table', async () => {
        // Create an extra table to delete
        const extraTableRes = await request(context.app)
          .post(`/api/v3/meta/bases/${initBase.id}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'TableToDelete',
            fields: [{ title: 'Title', type: 'SingleLineText' }],
          })
          .expect(200);

        const source = (await initBase.getSources())[0];
        const extraTable = await Model.getByAliasOrId(ctx, {
          source_id: source.id,
          aliasOrId: extraTableRes.body.id,
          base_id: initBase.id,
        });

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'tableDelete', tableId: extraTable.id })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'tableDelete', tableId: table.id })
          .send({})
          .expect(401);
      });
    });

    // ── columnDelete ────────────────────────────────────────────────

    describe('columnDelete (POST)', () => {
      it('should delete a column', async () => {
        // Add a column to delete
        const addRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'ToDelete', uidt: 'SingleLineText' })
          .expect(200);

        // Get the column ID
        const columns = await table.getColumns(ctx);
        const colToDelete = columns.find((c: any) => c.title === 'ToDelete');
        expect(colToDelete).to.exist;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnDelete', columnId: colToDelete.id })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const columns = await table.getColumns(ctx);
        const col = columns.find((c: any) => c.title === 'Number');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnDelete', columnId: col.id })
          .send({})
          .expect(401);
      });
    });

    // ── nestedDataUnlink ────────────────────────────────────────────

    describe('nestedDataUnlink (POST)', () => {
      it('should unlink nested records', async () => {
        // Create a second table for linking
        const table2Res = await request(context.app)
          .post(`/api/v3/meta/bases/${initBase.id}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'LinkedTable',
            fields: [{ title: 'Name', type: 'SingleLineText' }],
          })
          .expect(200);

        const source = (await initBase.getSources())[0];
        const table2 = await Model.getByAliasOrId(ctx, {
          source_id: source.id,
          aliasOrId: table2Res.body.id,
          base_id: initBase.id,
        });

        // Add a Links column
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'Link',
            uidt: 'Links',
            parentId: table.id,
            childId: table2.id,
            type: 'hm',
          })
          .expect(200);

        // Get link column ID
        const columns = await table.getColumns(ctx);
        const linkCol = columns.find((c: any) => c.title === 'Link');

        // Insert rows in both tables
        const row1Res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataInsert',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ Title: 'Parent' })
          .expect(200);

        const row1Id = String(
          row1Res.body.Id ?? row1Res.body.id ?? '1',
        );

        // Get table2 default view
        const t2ViewRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewList', tableId: table2.id })
          .set('xc-token', context.xc_token)
          .expect(200);
        const t2ViewId = t2ViewRes.body.list[0].id;

        const row2Res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataInsert',
            tableId: table2.id,
            viewId: t2ViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ Name: 'Child' })
          .expect(200);

        const row2Id = String(
          row2Res.body.Id ?? row2Res.body.id ?? '1',
        );

        // Link them
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataLink',
            tableId: table.id,
            viewId: defaultViewId,
            columnId: linkCol.id,
            rowId: row1Id,
          })
          .set('xc-token', context.xc_token)
          .send([{ Id: row2Id }])
          .expect(200);

        // Unlink
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataUnlink',
            tableId: table.id,
            viewId: defaultViewId,
            columnId: linkCol.id,
            rowId: row1Id,
          })
          .set('xc-token', context.xc_token)
          .send([{ Id: row2Id }])
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataUnlink',
            tableId: table.id,
            viewId: defaultViewId,
            columnId: 'fake-col',
            rowId: '1',
          })
          .send([{ Id: '1' }])
          .expect(401);
      });
    });

    // ── nestedDataListCopyPasteOrDeleteAll ───────────────────────────

    describe('nestedDataListCopyPasteOrDeleteAll (POST)', () => {
      it('should delete all linked records', async () => {
        // Create a second table for linking
        const table2Res = await request(context.app)
          .post(`/api/v3/meta/bases/${initBase.id}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'LinkCPDTable',
            fields: [{ title: 'Name', type: 'SingleLineText' }],
          })
          .expect(200);

        const source = (await initBase.getSources())[0];
        const table2 = await Model.getByAliasOrId(ctx, {
          source_id: source.id,
          aliasOrId: table2Res.body.id,
          base_id: initBase.id,
        });

        // Add a Links column
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'LinkCPD',
            uidt: 'Links',
            parentId: table.id,
            childId: table2.id,
            type: 'hm',
          })
          .expect(200);

        const columns = await table.getColumns(ctx);
        const linkCol = columns.find((c: any) => c.title === 'LinkCPD');

        // Insert row in parent table
        const row1Res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataInsert',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ Title: 'ParentCPD' })
          .expect(200);

        const row1Id = String(
          row1Res.body.Id ?? row1Res.body.id ?? '1',
        );

        // Get related model ID from link column
        const updatedColumns = await table.getColumns(ctx);
        const linkColFull = updatedColumns.find(
          (c: any) => c.title === 'LinkCPD',
        );
        const relatedModelId =
          linkColFull?.colOptions?.fk_related_model_id ?? table2.id;

        // Delete all links (even if none exist, should succeed)
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataListCopyPasteOrDeleteAll',
            tableId: table.id,
            viewId: defaultViewId,
            columnId: linkCol.id,
            rowId: row1Id,
          })
          .set('xc-token', context.xc_token)
          .send([
            {
              operation: 'deleteAll',
              rowId: row1Id,
              columnId: linkCol.id,
              fk_related_model_id: relatedModelId,
            },
          ])
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataListCopyPasteOrDeleteAll',
            tableId: table.id,
            viewId: defaultViewId,
            columnId: 'fake-col',
            rowId: '1',
          })
          .send([
            {
              operation: 'deleteAll',
              rowId: '1',
              columnId: 'fake-col',
              fk_related_model_id: 'fake-model',
            },
          ])
          .expect(401);
      });
    });
  });
};
