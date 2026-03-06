import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const eeFilterListviewMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - EE Filter & List View Mutations (POST)', () => {
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

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'EEFilterBase' })
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
          title: 'EEFilterTable',
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

      // Get column IDs
      const columns = await table.getColumns(ctx);
      titleColumnId = columns.find((c: any) => c.title === 'Title')?.id;

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

    // ── linkFilterCreate ────────────────────────────────────────────

    describe('linkFilterCreate (POST)', () => {
      it('should create a filter on a link column', async () => {
        // Create a second table + link column
        const table2Res = await request(context.app)
          .post(`/api/v3/meta/bases/${initBase.id}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'LinkFilterTarget',
            fields: [{ title: 'Name', type: 'SingleLineText' }],
          })
          .expect(200);

        const source = (await initBase.getSources())[0];
        const table2 = await Model.getByAliasOrId(ctx, {
          source_id: source.id,
          aliasOrId: table2Res.body.id,
          base_id: initBase.id,
        });

        // Add link column
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'LinkForFilter',
            uidt: 'Links',
            parentId: table.id,
            childId: table2.id,
            type: 'hm',
          })
          .expect(200);

        const columns = await table.getColumns(ctx);
        const linkCol = columns.find((c: any) => c.title === 'LinkForFilter');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'linkFilterCreate', columnId: linkCol.id })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return error without authentication', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'linkFilterCreate', columnId: 'fake-col' })
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          });

        expect(res.status).to.be.oneOf([401, 404]);
      });
    });

    // ── buttonFilterCreate ──────────────────────────────────────────

    describe('buttonFilterCreate (POST)', () => {
      it('should create a filter on a button column', async () => {
        // Add a button column
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'columnAdd', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'ButtonCol',
            uidt: 'Button',
            formula_raw: 'TRUE()',
          })
          .expect(200);

        const columns = await table.getColumns(ctx);
        const buttonCol = columns.find((c: any) => c.title === 'ButtonCol');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'buttonFilterCreate',
            buttonColId: buttonCol.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'buttonFilterCreate',
            buttonColId: 'fake-col',
          })
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(401);
      });
    });

    // ── widgetFilterCreate ──────────────────────────────────────────

    describe('widgetFilterCreate (POST)', () => {
      it('should return error without authentication', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'widgetFilterCreate',
            widgetId: 'fake-widget',
          })
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          });

        expect(res.status).to.be.oneOf([401, 404]);
      });
    });

    // ── rowColorConditionsFilterCreate ───────────────────────────────

    describe('rowColorConditionsFilterCreate (POST)', () => {
      it('should create a filter on row color conditions', async () => {
        // Create a row color condition first
        const condRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewRowColorConditionAdd',
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({
            color: '#FF0000',
            nc_order: 1,
            type: 'condition',
            filter: {
              fk_column_id: titleColumnId,
              comparison_op: 'eq',
              value: 'test',
            },
          })
          .expect(200);

        const conditionId = condRes.body.id;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'rowColorConditionsFilterCreate',
            rowColorConditionId: conditionId,
          })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'neq',
            value: 'other',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return error without authentication', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'rowColorConditionsFilterCreate',
            rowColorConditionId: 'fake-id',
          })
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          });

        expect(res.status).to.be.oneOf([401, 404]);
      });
    });

    // ── listViewCreate ──────────────────────────────────────────────

    describe('listViewCreate (POST)', () => {
      it('should create a list view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'listViewCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'TestListView' })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('TestListView');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'listViewCreate', tableId: table.id })
          .send({ title: 'AuthListView' })
          .expect(401);
      });
    });

    // ── listViewUpdate ──────────────────────────────────────────────

    describe('listViewUpdate (POST)', () => {
      it('should update a list view', async () => {
        // Create list view first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'listViewCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'ListForUpdate' })
          .expect(200);

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'listViewUpdate',
            viewId: createRes.body.id,
          })
          .set('xc-token', context.xc_token)
          .send({ fk_cover_image_col_id: null })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'listViewCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'ListAuth' })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'listViewUpdate',
            viewId: createRes.body.id,
          })
          .send({ fk_cover_image_col_id: null })
          .expect(401);
      });
    });
  });
};
