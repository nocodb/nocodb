import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base } from '~/models';
import { RootScopes } from '~/utils/globals';

export const extensionsGetTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Extensions GET', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let extensionId: string;
    let INTERNAL_API_BASE: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'ExtensionsTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Override feature flag
      featureMock = await overrideFeature({
        workspace_id: workspaceId,
        feature: PlanFeatureTypes.FEATURE_API_VIEW_V3,
        allowed: true,
      });

      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      // Create extension via internal POST API
      const extRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'extensionCreate' })
        .set('xc-token', context.xc_token)
        .send({
          title: 'TestExtension',
          extension_id: 'test-extension-id',
          base_id: baseId,
        })
        .expect(200);

      extensionId = extRes.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── extensionList ─────────────────────────────────────────────────

    describe('extensionList (GET)', () => {
      it('should list extensions for a base', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'extensionList' })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return extension with correct structure', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'extensionList' })
          .set('xc-token', context.xc_token)
          .expect(200);

        const ext = response.body.list.find(
          (e: any) => e.id === extensionId,
        );
        expect(ext).to.not.be.undefined;
        expect(ext).to.have.property('id');
        expect(ext).to.have.property('title', 'TestExtension');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'extensionList' })
          .expect(401);
      });
    });

    // ── extensionRead ─────────────────────────────────────────────────

    describe('extensionRead (GET)', () => {
      it('should read a specific extension', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'extensionRead', extensionId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id', extensionId);
        expect(response.body).to.have.property('title', 'TestExtension');
      });

      it('should return 404 with invalid extensionId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'extensionRead',
            extensionId: 'invalid-ext-id',
          })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });
  });
};
