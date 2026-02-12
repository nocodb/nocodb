import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewSharingTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Sharing', () => {
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

    describe('shareView (POST)', () => {
      it.skip('should create public share for view', async () => {
        // TODO: Implement
      });

      it.skip('should generate UUID when sharing view', async () => {
        // TODO: Implement
      });

      it.skip('should share view with password', async () => {
        // TODO: Implement
      });

      it.skip('should share view with meta options (allowCSVDownload)', async () => {
        // TODO: Implement
      });

      it.skip('should return 403 when non-owner shares personal view', async () => {
        // TODO: Implement
      });
    });

    describe('shareViewUpdate (POST)', () => {
      it.skip('should update share password', async () => {
        // TODO: Implement
      });

      it.skip('should update share meta options', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 for unshared view', async () => {
        // TODO: Implement
      });
    });

    describe('shareViewDelete (POST)', () => {
      it.skip('should delete view share', async () => {
        // TODO: Implement
      });

      it.skip('should verify share is removed', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 for unshared view', async () => {
        // TODO: Implement
      });
    });
  });
}
