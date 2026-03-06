import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const tableSchemaGetTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Table & Schema GET', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let formViewId: string;
    let mapViewId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'TableSchemaTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Create table with multiple field types
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'SchemaTestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
            { title: 'DateTime', type: 'DateTime' },
            {
              title: 'SingleSelect',
              type: 'SingleSelect',
              options: {
                choices: [
                  { title: 'Option1', color: '#ff0000' },
                  { title: 'Option2', color: '#00ff00' },
                ],
              },
            },
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

      // Get default view ID
      const viewListRes = await request(context.app)
        .get(INTERNAL_API_BASE)
        .query({ operation: 'viewList', tableId: table.id })
        .set('xc-token', context.xc_token)
        .expect(200);

      defaultViewId = viewListRes.body.list[0].id;

      // Create form view
      const formRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'formViewCreate', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({ title: 'TestFormView' })
        .expect(200);

      formViewId = formRes.body.id;

      // Create map view
      const mapRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'mapViewCreate', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({ title: 'TestMapView' })
        .expect(200);

      mapViewId = mapRes.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── tableGet ──────────────────────────────────────────────────────

    describe('tableGet (GET)', () => {
      it('should return table with accessible views', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'tableGet', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id', table.id);
        expect(response.body).to.have.property('title');
      });

      it('should return 404 with invalid tableId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'tableGet', tableId: 'invalid-table-id' })
          .set('xc-token', context.xc_token)
          .expect(404);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'tableGet', tableId: table.id })
          .expect(401);
      });
    });

    // ── columnsHash ───────────────────────────────────────────────────

    describe('columnsHash (GET)', () => {
      it('should return a columns hash for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'columnsHash', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('hash');
      });

      it('should return 404 with invalid tableId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'columnsHash', tableId: 'invalid-table-id' })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    // ── viewList ──────────────────────────────────────────────────────

    describe('viewList (GET)', () => {
      it('should list all views for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewList', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        // Should have default grid + form + map = 3 views
        expect(response.body.list.length).to.be.greaterThanOrEqual(3);
      });

      it('should return views with correct structure', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewList', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        const view = response.body.list[0];
        expect(view).to.have.property('id');
        expect(view).to.have.property('title');
        expect(view).to.have.property('type');
        expect(view).to.have.property('fk_model_id');
      });

      it('should return 404 with invalid tableId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewList', tableId: 'invalid-table-id' })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    // ── viewColumnList ────────────────────────────────────────────────

    describe('viewColumnList (GET)', () => {
      it('should list columns for a view', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return view columns with correct structure', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        const col = response.body.list[0];
        expect(col).to.have.property('id');
        expect(col).to.have.property('fk_view_id');
        expect(col).to.have.property('fk_column_id');
      });

      it('should return 404 with invalid viewId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: 'invalid-view-id' })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    // ── viewRowColorInfo ──────────────────────────────────────────────

    describe('viewRowColorInfo (GET)', () => {
      it('should return row color info for a view', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewRowColorInfo', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        // May return null/empty when no row colors configured
        expect(response.status).to.eq(200);
      });
    });

    // ── formViewGet ───────────────────────────────────────────────────

    describe('formViewGet (GET)', () => {
      it('should return form view configuration', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'formViewGet', formViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('fk_view_id');
        expect(response.body).to.have.property('columns');
      });

      it('should return 404 with invalid formViewId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'formViewGet', formViewId: 'invalid-id' })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    // ── mapViewGet ────────────────────────────────────────────────────

    describe('mapViewGet (GET)', () => {
      it('should return map view configuration', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'mapViewGet', mapViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('fk_view_id');
      });

      it('should return empty result with invalid mapViewId', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'mapViewGet', mapViewId: 'invalid-id' })
          .set('xc-token', context.xc_token)
          .expect(200);

        // MapView.get returns null for invalid IDs
        expect(response.body).to.satisfy(
          (body: any) => body === null || Object.keys(body).length === 0,
        );
      });
    });
  });
};
