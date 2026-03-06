import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const tableColumnMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Table & Column Mutations (POST)', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let source: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let titleColumnId: string;
    let numberColumnId: string;
    let deleteTableId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'TableColMutTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Create table with fields
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'TestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
          ],
        })
        .expect(200);

      // Create second table for deletion test
      const deleteTableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'DeleteMeTable',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        })
        .expect(200);

      // Get table models
      source = (await initBase.getSources())[0];
      ctx = { base_id: initBase.id, workspace_id: workspaceId };
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: tableResult.body.id,
        base_id: initBase.id,
      });

      const deleteTable = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: deleteTableResult.body.id,
        base_id: initBase.id,
      });
      deleteTableId = deleteTable.id;

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

      // Get columns
      const columns = await table.getColumns(ctx);
      const titleColumn = columns.find((col: any) => col.title === 'Title');
      titleColumnId = titleColumn.id;
      const numberColumn = columns.find((col: any) => col.title === 'Number');
      numberColumnId = numberColumn.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── tableUpdate ─────────────────────────────────────────────────

    describe('tableUpdate (POST)', () => {
      it('should update table title', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'tableUpdate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ table_name: 'UpdatedTableName' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'tableUpdate', tableId: table.id })
          .send({ table_name: 'Fail' })
          .expect(401);
      });
    });

    // ── tableDelete ─────────────────────────────────────────────────

    describe('tableDelete (POST)', () => {
      it('should delete a table', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'tableDelete', tableId: deleteTableId })
          .set('xc-token', context.xc_token)
          .send({ forceDeleteRelations: true })
          .expect(200);

        expect(response.body).to.equal(true);
      });
    });

    // ── tableReorder ────────────────────────────────────────────────

    describe('tableReorder (POST)', () => {
      it('should reorder a table', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'tableReorder', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ order: 2 })
          .expect(200);
      });
    });

    // ── columnAdd ───────────────────────────────────────────────────

    describe('columnAdd (POST)', () => {
      it('should add a new column', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'NewCol', uidt: 'SingleLineText' })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });
    });

    // ── columnUpdate ────────────────────────────────────────────────

    describe('columnUpdate (POST)', () => {
      it('should update a column title', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnUpdate', columnId: numberColumnId })
          .set('xc-token', context.xc_token)
          .send({ title: 'RenamedNumber' })
          .expect(200);

        expect(response.body).to.be.an('object');
      });
    });

    // ── columnDelete ────────────────────────────────────────────────

    describe('columnDelete (POST)', () => {
      it('should delete a column', async () => {
        // First add a temporary column
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'TempCol', uidt: 'SingleLineText' })
          .expect(200);

        // Re-query columns from model to get the new column's ID
        const freshTable = await Model.getByAliasOrId(ctx, {
          source_id: source.id,
          aliasOrId: table.id,
          base_id: initBase.id,
        });
        const updatedCols = await freshTable.getColumns(ctx);
        const tempCol = updatedCols.find((c: any) => c.title === 'TempCol');

        // Then delete it
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnDelete', columnId: tempCol.id })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);
      });
    });

    // ── columnSetAsPrimary ──────────────────────────────────────────

    describe('columnSetAsPrimary (POST)', () => {
      it('should set a column as primary', async () => {
        // Add a second text column
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'SecondTitle', uidt: 'SingleLineText' })
          .expect(200);

        // Re-query columns from model to get the new column's ID
        const freshTable = await Model.getByAliasOrId(ctx, {
          source_id: source.id,
          aliasOrId: table.id,
          base_id: initBase.id,
        });
        const updatedCols = await freshTable.getColumns(ctx);
        const secondCol = updatedCols.find(
          (c: any) => c.title === 'SecondTitle',
        );

        // Set it as primary
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'columnSetAsPrimary',
            columnId: secondCol.id,
          })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);
      });
    });

    // ── columnsBulk ─────────────────────────────────────────────────

    describe('columnsBulk (POST)', () => {
      it('should perform bulk column operations', async () => {
        // Get current columns hash for optimistic concurrency
        const hashRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'columnsHash', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnsBulk', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            hash: hashRes.body.hash,
            ops: [
              {
                op: 'fields.add',
                column: { title: 'BulkCol', uidt: 'SingleLineText' },
              },
            ],
          })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── convertLinkToV2 ─────────────────────────────────────────────

    describe('convertLinkToV2 (POST)', () => {
      it.skip('requires LTAR column setup', () => {
        // This operation requires a Links column pointing to another table
      });
    });
  });
};
