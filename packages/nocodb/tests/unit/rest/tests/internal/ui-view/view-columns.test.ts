import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewColumnsTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Columns', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'ViewTestBase' })
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
          title: 'ViewTestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
            { title: 'DateTime', type: 'DateTime' },
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
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('viewColumnList (GET)', () => {
      it.skip('should get all columns for a view', async () => {
        // TODO: Implement
      });

      it.skip('should verify column structure (field_id, show, order, width)', async () => {
        // TODO: Implement
      });

      it.skip('should list columns for view with hidden columns', async () => {
        // TODO: Implement
      });

      it.skip('should return columns in correct order', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });
    });

    describe('viewColumnCreate (POST)', () => {
      it.skip('should create view column for new field', async () => {
        // TODO: Implement
      });

      it.skip('should create view column with visibility settings', async () => {
        // TODO: Implement
      });

      it.skip('should create view column with custom order', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 for duplicate view column', async () => {
        // TODO: Implement
      });
    });

    describe('viewColumnUpdate (POST)', () => {
      it.skip('should update column visibility (show/hide)', async () => {
        // TODO: Implement
      });

      it.skip('should update column order', async () => {
        // TODO: Implement
      });

      it.skip('should update column width', async () => {
        // TODO: Implement
      });

      it.skip('should update multiple properties together', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid field_id', async () => {
        // TODO: Implement
      });
    });

    describe('showAllColumns (POST)', () => {
      it.skip('should show all hidden columns', async () => {
        // TODO: Implement
      });

      it.skip('should verify all columns visible after operation', async () => {
        // TODO: Implement
      });

      it.skip('should handle view with all columns already visible', async () => {
        // TODO: Implement
      });
    });

    describe('hideAllColumns (POST)', () => {
      it.skip('should hide all non-essential columns', async () => {
        // TODO: Implement
      });

      it.skip('should verify display value and system columns remain visible', async () => {
        // TODO: Implement
      });

      it.skip('should handle view with all columns already hidden', async () => {
        // TODO: Implement
      });
    });

    describe('gridColumnUpdate (POST)', () => {
      it.skip('should update grid column width', async () => {
        // TODO: Implement
      });

      it.skip('should update grid column aggregation', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid columnId', async () => {
        // TODO: Implement
      });

      it.skip('should maintain view integrity', async () => {
        // TODO: Implement
      });
    });
  });
}
