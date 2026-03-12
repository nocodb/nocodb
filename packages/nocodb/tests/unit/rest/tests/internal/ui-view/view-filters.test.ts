import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewFiltersTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Filters', () => {
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
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('filterList (GET)', () => {
      it.skip('should get all filters for a view', async () => {
        // TODO: Implement
      });

      it.skip('should return correct structure (fk_column_id, comparison_op, value)', async () => {
        // TODO: Implement
      });

      it.skip('should handle view with no filters', async () => {
        // TODO: Implement
      });

      it.skip('should include nested filter groups', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });
    });

    describe('filterChildrenList (GET)', () => {
      it.skip('should get children of filter group', async () => {
        // TODO: Implement
      });

      it.skip('should return empty for leaf filter', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid filterId', async () => {
        // TODO: Implement
      });
    });

    describe('filterCreate (POST)', () => {
      it.skip('should create simple filter (eq, neq, like)', async () => {
        // TODO: Implement
      });

      it.skip('should create filter with comparison operators (gt, lt, gte, lte)', async () => {
        // TODO: Implement
      });

      it.skip('should create filter group (and, or)', async () => {
        // TODO: Implement
      });

      it.skip('should create nested filter (parent filter group)', async () => {
        // TODO: Implement
      });

      it.skip('should create filter on SingleSelect field', async () => {
        // TODO: Implement
      });

      it.skip('should create filter on DateTime field', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid field_id', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid comparison_op', async () => {
        // TODO: Implement
      });
    });

    describe('filterUpdate (POST)', () => {
      it.skip('should update filter comparison operator', async () => {
        // TODO: Implement
      });

      it.skip('should update filter value', async () => {
        // TODO: Implement
      });

      it.skip('should update filter logical operator (and/or)', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid filterId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid comparison_op', async () => {
        // TODO: Implement
      });
    });

    describe('filterDelete (POST)', () => {
      it.skip('should delete filter from view', async () => {
        // TODO: Implement
      });

      it.skip('should delete filter group and all children', async () => {
        // TODO: Implement
      });

      it.skip('should verify data reflects filter changes', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid filterId', async () => {
        // TODO: Implement
      });
    });

    describe('linkFilterList (GET) - EE only', () => {
      it.skip('should get filters on link columns', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid columnId', async () => {
        // TODO: Implement
      });
    });

    describe('linkFilterCreate (POST) - EE only', () => {
      it.skip('should create filter on link column', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid columnId', async () => {
        // TODO: Implement
      });
    });

    describe('widgetFilterList (GET) - EE only', () => {
      it.skip('should get filters on widget', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid widgetId', async () => {
        // TODO: Implement
      });
    });
  });
}
