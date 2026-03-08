import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewSortsTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Sorts', () => {
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

    describe('sortList (GET)', () => {
      it.skip('should get all sorts for a view', async () => {
        // TODO: Implement
      });

      it.skip('should return correct structure (fk_column_id, direction, order)', async () => {
        // TODO: Implement
      });

      it.skip('should handle view with no sorts', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });
    });

    describe('sortCreate (POST)', () => {
      it.skip('should create ascending sort', async () => {
        // TODO: Implement
      });

      it.skip('should create descending sort', async () => {
        // TODO: Implement
      });

      it.skip('should create multiple sorts (order matters)', async () => {
        // TODO: Implement
      });

      it.skip('should create sort on SingleSelect field', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid field_id', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid direction', async () => {
        // TODO: Implement
      });
    });

    describe('sortUpdate (POST)', () => {
      it.skip('should update sort direction', async () => {
        // TODO: Implement
      });

      it.skip('should update sort order', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid sortId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid direction', async () => {
        // TODO: Implement
      });
    });

    describe('sortDelete (POST)', () => {
      it.skip('should delete sort from view', async () => {
        // TODO: Implement
      });

      it.skip('should reorder remaining sorts', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid sortId', async () => {
        // TODO: Implement
      });
    });
  });
}
