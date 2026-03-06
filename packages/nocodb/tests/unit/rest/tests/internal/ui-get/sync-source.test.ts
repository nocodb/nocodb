import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base } from '~/models';
import { RootScopes } from '~/utils/globals';

export const syncSourceGetTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Sync Source GET', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let sourceId: string;
    let INTERNAL_API_BASE: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'SyncSourceTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Get default source ID
      const sources = await initBase.getSources();
      sourceId = sources[0].id;

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

    // ── syncSourceList ────────────────────────────────────────────────

    describe('syncSourceList (GET)', () => {
      it('should return sync source list for a base/source', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceList', sourceId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceList', sourceId })
          .expect(401);
      });
    });
  });
};
