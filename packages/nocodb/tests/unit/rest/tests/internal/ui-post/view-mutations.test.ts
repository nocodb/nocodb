import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Mutations (POST)', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let titleColumnId: string;
    let extraViewId: string;
    let deleteViewId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'ViewMutTestBase' })
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
          title: 'ViewMutTable',
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

      // Get title column
      const columns = await table.getColumns(ctx);
      const titleColumn = columns.find((col: any) => col.title === 'Title');
      titleColumnId = titleColumn.id;

      // Create extra view for update tests
      const extraViewRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'gridViewCreate', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({ title: 'ExtraView' })
        .expect(200);

      extraViewId = extraViewRes.body.id;

      // Create another view for delete tests
      const deleteViewRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'gridViewCreate', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({ title: 'DeleteMeView' })
        .expect(200);

      deleteViewId = deleteViewRes.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── viewUpdate ──────────────────────────────────────────────────

    describe('viewUpdate (POST)', () => {
      it('should update view title', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'viewUpdate', viewId: extraViewId })
          .set('xc-token', context.xc_token)
          .send({ title: 'UpdatedViewName' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'viewUpdate', viewId: extraViewId })
          .send({ title: 'Fail' })
          .expect(401);
      });
    });

    // ── viewDelete ──────────────────────────────────────────────────

    describe('viewDelete (POST)', () => {
      it('should delete a view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'viewDelete', viewId: deleteViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        // viewDelete returns empty object on success
        expect(response.status).to.equal(200);
      });
    });

    // ── shareView ───────────────────────────────────────────────────

    describe('shareView (POST)', () => {
      it('should share a view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'shareView', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('uuid');
      });
    });

    // ── shareViewUpdate ─────────────────────────────────────────────

    describe('shareViewUpdate (POST)', () => {
      it('should update shared view settings', async () => {
        // First share the view
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'shareView', viewId: extraViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        // Then update share settings
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'shareViewUpdate', viewId: extraViewId })
          .set('xc-token', context.xc_token)
          .send({ password: 'test123' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── shareViewDelete ─────────────────────────────────────────────

    describe('shareViewDelete (POST)', () => {
      it('should delete shared view', async () => {
        // First share the view
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'shareView', viewId: deleteViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        // Then delete the share
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'shareViewDelete', viewId: deleteViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });
    });

    // ── showAllColumns ──────────────────────────────────────────────

    describe('showAllColumns (POST)', () => {
      it('should show all columns in a view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'showAllColumns', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── hideAllColumns ──────────────────────────────────────────────

    describe('hideAllColumns (POST)', () => {
      it('should hide all columns in a view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hideAllColumns', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── viewColumnUpdate ────────────────────────────────────────────

    describe('viewColumnUpdate (POST)', () => {
      it('should update a view column visibility', async () => {
        // Get view column list to find a column ID
        const colListRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        const viewColumn = colListRes.body.list.find(
          (vc: any) => vc.fk_column_id === titleColumnId,
        );

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewColumnUpdate',
            viewId: defaultViewId,
            columnId: viewColumn.id,
          })
          .set('xc-token', context.xc_token)
          .send({ show: false })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── viewColumnCreate ────────────────────────────────────────────

    describe('viewColumnCreate (POST)', () => {
      it('should create a view column entry', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({ fk_column_id: titleColumnId, show: true })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── gridColumnUpdate ────────────────────────────────────────────

    describe('gridColumnUpdate (POST)', () => {
      it('should update grid column width', async () => {
        // Get view column list to find the grid view column ID
        const colListRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        const gridViewColumnId = colListRes.body.list[0].id;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridColumnUpdate',
            gridViewColumnId,
          })
          .set('xc-token', context.xc_token)
          .send({ width: '200px' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });
  });
};
