import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewRowColoringTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Row Coloring (POST)', () => {
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
    let singleSelectColumnId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'RowColorTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Create table with fields including SingleSelect
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'RowColorTable',
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

      // Add a SingleSelect column via internal API
      await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'columnAdd', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({
          title: 'Status',
          uidt: 'SingleSelect',
          dtxp: "'Active','Inactive'",
        })
        .expect(200);

      // Re-query columns to get the SingleSelect column ID
      const updatedCols = await table.getColumns(ctx);
      const selectCol = updatedCols.find((c: any) => c.title === 'Status');
      singleSelectColumnId = selectCol.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── viewRowColorConditionAdd ────────────────────────────────────

    describe('viewRowColorConditionAdd (POST)', () => {
      it('should add a row color condition', async () => {
        const response = await request(context.app)
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

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });
    });

    // ── viewRowColorConditionUpdate ─────────────────────────────────

    describe('viewRowColorConditionUpdate (POST)', () => {
      it('should update a row color condition', async () => {
        // First add a condition
        const addRes = await request(context.app)
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

        const conditionId = addRes.body.id;

        // Then update it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewRowColorConditionUpdate',
            viewId: defaultViewId,
            rowColorConditionId: conditionId,
          })
          .set('xc-token', context.xc_token)
          .send({ color: '#00FF00' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── viewRowColorConditionDelete ─────────────────────────────────

    describe('viewRowColorConditionDelete (POST)', () => {
      it('should delete a row color condition', async () => {
        // First add a condition
        const addRes = await request(context.app)
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

        const conditionId = addRes.body.id;

        // Then delete it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewRowColorConditionDelete',
            viewId: defaultViewId,
            rowColorConditionId: conditionId,
          })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });
    });

    // ── viewRowColorSelectAdd ───────────────────────────────────────

    describe('viewRowColorSelectAdd (POST)', () => {
      it('should set row coloring to select mode', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewRowColorSelectAdd',
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: singleSelectColumnId,
            is_set_as_background: false,
          })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── viewRowColorInfoDelete ──────────────────────────────────────

    describe('viewRowColorInfoDelete (POST)', () => {
      it('should remove all row color info from a view', async () => {
        // First add a condition so there is something to remove
        await request(context.app)
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

        // Then remove all
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewRowColorInfoDelete',
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });
    });
  });
};
