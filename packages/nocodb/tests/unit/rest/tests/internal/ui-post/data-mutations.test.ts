import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const dataMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Data Mutations (POST)', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let rowId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'DataMutBase' })
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
          title: 'DataMutTable',
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

      // Insert a row
      const insertRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({
          operation: 'dataInsert',
          tableId: table.id,
          viewId: defaultViewId,
        })
        .set('xc-token', context.xc_token)
        .send({ Title: 'TestRow', Number: 42 })
        .expect(200);

      rowId = String(insertRes.body.Id ?? insertRes.body.id ?? '1');
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── dataUpdate ──────────────────────────────────────────────────

    describe('dataUpdate (POST)', () => {
      it('should update a row successfully', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataUpdate',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ Id: rowId, Title: 'UpdatedRow' })
          .expect(200);

        expect(response.body).to.be.an('object');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataUpdate',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .send({ Id: rowId, Title: 'Fail' })
          .expect(401);
      });
    });

    // ── dataDelete ──────────────────────────────────────────────────

    describe('dataDelete (POST)', () => {
      it('should delete a row successfully', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataDelete',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ Id: rowId })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataDelete',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .send({ Id: rowId })
          .expect(401);
      });
    });

    // ── bulkDataDeleteAll ───────────────────────────────────────────

    describe('bulkDataDeleteAll (POST)', () => {
      it('should delete all rows matching a where condition', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'bulkDataDeleteAll',
            tableId: table.id,
            viewId: defaultViewId,
            where: '(Title,eq,TestRow)',
          })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'bulkDataDeleteAll',
            tableId: table.id,
            viewId: defaultViewId,
            where: '(Title,eq,TestRow)',
          })
          .send({})
          .expect(401);
      });
    });

    // ── dataExport ──────────────────────────────────────────────────

    describe('dataExport (POST)', () => {
      it('should trigger a CSV export job', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataExport',
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ options: { type: 'csv' } })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataExport',
            viewId: defaultViewId,
          })
          .send({ options: { type: 'csv' } })
          .expect(401);
      });
    });

    // ── bulkAggregate ───────────────────────────────────────────────

    describe('bulkAggregate (POST)', () => {
      it('should return aggregate data for views', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'bulkAggregate',
            tableId: table.id,
            viewId: defaultViewId,
            baseId,
          })
          .set('xc-token', context.xc_token)
          .send({ viewIds: [defaultViewId] })
          .expect(200);

        expect(response.body).to.be.an('object');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'bulkAggregate',
            tableId: table.id,
            viewId: defaultViewId,
            baseId,
          })
          .send({ viewIds: [defaultViewId] })
          .expect(401);
      });
    });

    // ── bulkDataList ────────────────────────────────────────────────

    describe('bulkDataList (POST)', () => {
      it('should return bulk data for views', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'bulkDataList',
            tableId: table.id,
            viewId: defaultViewId,
            baseId,
          })
          .set('xc-token', context.xc_token)
          .send([{ limit: 10 }])
          .expect(200);

        expect(response.body).to.be.an('object');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'bulkDataList',
            tableId: table.id,
            viewId: defaultViewId,
            baseId,
          })
          .send([{ limit: 10 }])
          .expect(401);
      });
    });
  });
};
