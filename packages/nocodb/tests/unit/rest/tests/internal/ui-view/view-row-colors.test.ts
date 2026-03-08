import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewRowColorsTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Row Colors', () => {
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

    describe('viewRowColorInfo (GET)', () => {
      it.skip('should get row color configuration for view', async () => {
        // TODO: Implement
      });

      it.skip('should get row color info with conditions', async () => {
        // TODO: Implement
      });

      it.skip('should get row color info with select options', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });
    });

    describe('viewRowColorConditionAdd (POST)', () => {
      it.skip('should add filter-based row color condition', async () => {
        // TODO: Implement
      });

      it.skip('should add row color with specific color', async () => {
        // TODO: Implement
      });

      it.skip('should add multiple row color conditions', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid filter', async () => {
        // TODO: Implement
      });
    });

    describe('viewRowColorConditionUpdate (POST)', () => {
      it.skip('should update row color condition color', async () => {
        // TODO: Implement
      });

      it.skip('should update row color condition filter', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid conditionId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid color format', async () => {
        // TODO: Implement
      });
    });

    describe('viewRowColorConditionDelete (POST)', () => {
      it.skip('should delete row color condition', async () => {
        // TODO: Implement
      });

      it.skip('should delete all row color conditions', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid conditionId', async () => {
        // TODO: Implement
      });
    });

    describe('viewRowColorSelectAdd (POST)', () => {
      it.skip('should add select field for row coloring', async () => {
        // TODO: Implement
      });

      it.skip('should verify select options drive row colors', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid field_id', async () => {
        // TODO: Implement
      });
    });

    describe('viewRowColorInfoDelete (POST)', () => {
      it.skip('should delete all row coloring configuration', async () => {
        // TODO: Implement
      });

      it.skip('should verify view has no row colors after deletion', async () => {
        // TODO: Implement
      });
    });

    describe('rowColorConditionsFilterCreate (POST)', () => {
      it.skip('should create filter for row color condition', async () => {
        // TODO: Implement
      });

      it.skip('should create nested filter for row color', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid conditionId', async () => {
        // TODO: Implement
      });
    });
  });
}
