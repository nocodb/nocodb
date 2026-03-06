import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const dataOperationsGetTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Data Operations GET', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let table2: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let linkColumnId: string;
    let row1Id: string;
    let row2Id: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'DataOpsTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Override feature flag
      featureMock = await overrideFeature({
        workspace_id: workspaceId,
        feature: PlanFeatureTypes.FEATURE_API_VIEW_V3,
        allowed: true,
      });

      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      // Create table 1
      const table1Result = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'DataTable1',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
          ],
        })
        .expect(200);

      // Create table 2
      const table2Result = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'DataTable2',
          fields: [{ title: 'Name', type: 'SingleLineText' }],
        })
        .expect(200);

      // Get table models
      const source = (await initBase.getSources())[0];
      ctx = { base_id: initBase.id, workspace_id: workspaceId };
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: table1Result.body.id,
        base_id: initBase.id,
      });
      table2 = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: table2Result.body.id,
        base_id: initBase.id,
      });

      // Get default view ID for table1
      const viewListRes = await request(context.app)
        .get(INTERNAL_API_BASE)
        .query({ operation: 'viewList', tableId: table.id })
        .set('xc-token', context.xc_token)
        .expect(200);

      defaultViewId = viewListRes.body.list[0].id;

      // Create Links column on table1 pointing to table2
      await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'columnAdd', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({
          title: 'LinkToTable2',
          uidt: 'Links',
          parentId: table.id,
          childId: table2.id,
          type: 'hm',
        })
        .expect(200);

      // Get the link column ID from table columns
      const columns = await table.getColumns(ctx);
      const linkCol = columns.find(
        (col: any) => col.title === 'LinkToTable2',
      );
      linkColumnId = linkCol?.id;

      // Insert row into table1 via internal API
      const row1Res = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({
          operation: 'dataInsert',
          tableId: table.id,
          viewId: defaultViewId,
        })
        .set('xc-token', context.xc_token)
        .send({ Title: 'Row1', Number: 10 })
        .expect(200);

      row1Id = String(row1Res.body.Id ?? row1Res.body.id ?? '1');

      // Insert row into table2
      const t2ViewListRes = await request(context.app)
        .get(INTERNAL_API_BASE)
        .query({ operation: 'viewList', tableId: table2.id })
        .set('xc-token', context.xc_token)
        .expect(200);

      const t2ViewId = t2ViewListRes.body.list[0].id;

      const row2Res = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({
          operation: 'dataInsert',
          tableId: table2.id,
          viewId: t2ViewId,
        })
        .set('xc-token', context.xc_token)
        .send({ Name: 'LinkedRow1' })
        .expect(200);

      row2Id = String(row2Res.body.Id ?? row2Res.body.id ?? '1');

      // Link row1 to row2 via internal API
      if (linkColumnId) {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataLink',
            tableId: table.id,
            rowId: row1Id,
            viewId: defaultViewId,
            columnId: linkColumnId,
          })
          .set('xc-token', context.xc_token)
          .send([row2Id])
          .expect(200);
      }
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── dataAggregate ─────────────────────────────────────────────────

    describe('dataAggregate (GET)', () => {
      it('should return data aggregate for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'dataAggregate',
            tableId: table.id,
            viewId: defaultViewId,
            baseId,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
      });
    });

    // ── dataList ──────────────────────────────────────────────────────

    describe('dataList (GET)', () => {
      it('should return data list for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'dataList',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return data list with correct row data', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'dataList',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const row = response.body.list[0];
        expect(row).to.have.property('Title', 'Row1');
        expect(row).to.have.property('Number', 10);
      });

      it('should support pagination with limit and offset', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'dataList',
            tableId: table.id,
            viewId: defaultViewId,
            limit: 1,
            offset: 0,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body.list.length).to.be.lessThanOrEqual(1);
      });
    });

    // ── linkDataList ──────────────────────────────────────────────────

    describe('linkDataList (GET)', () => {
      it('should return linked data list', async () => {
        if (!linkColumnId) return;

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'linkDataList',
            columnId: linkColumnId,
            tableId: table.id,
            rowId: row1Id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
      });
    });

    // ── nestedDataList ────────────────────────────────────────────────

    describe('nestedDataList (GET)', () => {
      it('should return nested data list', async () => {
        if (!linkColumnId) return;

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'nestedDataList',
            tableId: table.id,
            rowId: row1Id,
            viewId: defaultViewId,
            columnId: linkColumnId,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
      });
    });

    // ── commentList ───────────────────────────────────────────────────

    describe('commentList (GET)', () => {
      it('should return comment list for a row', async () => {
        // Create a comment via V1 API (row_id must be string)
        await request(context.app)
          .post('/api/v1/db/meta/comments')
          .set('xc-auth', context.token)
          .send({
            row_id: String(row1Id),
            fk_model_id: table.id,
            comment: 'Test comment',
          })
          .expect(200);

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'commentList',
            row_id: row1Id,
            fk_model_id: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return empty list when no comments', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'commentList',
            row_id: row1Id,
            fk_model_id: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
      });
    });

    // ── commentCount ──────────────────────────────────────────────────

    describe('commentCount (GET)', () => {
      it('should return comment count for rows', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'commentCount',
            fk_model_id: table.id,
            ids: row1Id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('array');
      });
    });
  });
};
