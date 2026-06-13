import 'mocha';
import { expect } from 'chai';
import {
  IntegrationsType,
  OnDeleteAction,
  PlanFeatureTypes,
  PlanTitles,
  SyncCategory,
  SyncTrigger,
  SyncType,
} from 'nocodb-sdk';
import request from 'supertest';
import init from '~test/init';
import { isEE } from '~test/utils/helpers';
import { overridePlan } from '~test/utils/plan.utils';
import { Base } from '~/models';
import { RootScopes } from '~/utils/globals';

/**
 * Custom Sync gating tests
 *
 * `createSync` gates the CUSTOM sync category (external-DB sources such as
 * postgres/mssql) behind FEATURE_CUSTOM_SYNC, which is available from the
 * Business plan upward on cloud (Free + Plus block it). The category is
 * resolved from the integration manifest (sub_type → SyncCategory.CUSTOM),
 * not the client-supplied `sync_category`, so a postgres sync config always
 * trips the gate.
 *
 * The gate runs before the source/integration is resolved, so we can assert
 * it with a config that references a non-existent auth integration:
 *   - Gated:   ERR_FEATURE_NOT_SUPPORTED (403)
 *   - Allowed: fails further downstream (AuthIntegration not found, etc.) but
 *              never ERR_FEATURE_NOT_SUPPORTED
 */
export function customSyncGatingTests() {
  if (!isEE()) {
    return;
  }

  describe('Custom Sync Feature Gating', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let base: any;

    beforeEach(async function () {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'CustomSyncGatingTestBase' })
        .expect(200);

      base = await Base.getByTitleOrId(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        } as any,
        baseResult.body.id,
      );
    });

    function createSyncUrl() {
      return `/api/v2/internal/${workspaceId}/${base.id}?operation=createSync`;
    }

    /**
     * Sends a createSync request for a CUSTOM (postgres) sync. The category is
     * derived from the postgres-sync manifest, so the FEATURE_CUSTOM_SYNC gate
     * fires before the (non-existent) auth integration is resolved.
     */
    function attemptCustomSyncCreate() {
      return request(context.app)
        .post(createSyncUrl())
        .set('xc-auth', context.token)
        .send({
          title: `CustomSync-${Date.now()}`,
          sync_type: SyncType.Full,
          sync_trigger: SyncTrigger.Manual,
          on_delete_action: OnDeleteAction.MarkDeleted,
          sync_category: SyncCategory.CUSTOM,
          configs: [
            {
              type: IntegrationsType.Sync,
              sub_type: 'postgres',
              title: 'CustomSyncGatingIntegration',
              config: {
                authIntegrationId: 'int_nonexistent_auth',
                schema: 'public',
                tables: ['nonexistent_table'],
              },
            },
          ],
          meta: { sync_all_models: true, sync_excluded_models: [] },
        });
    }

    describe('Free plan', () => {
      let planMock: Awaited<ReturnType<typeof overridePlan>>;

      beforeEach(async () => {
        planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.FREE,
        });
      });

      afterEach(async () => {
        await planMock?.restore();
      });

      it('should block custom sync create with ERR_FEATURE_NOT_SUPPORTED', async () => {
        const res = await attemptCustomSyncCreate().expect(403);
        expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Plus plan', () => {
      let planMock: Awaited<ReturnType<typeof overridePlan>>;

      beforeEach(async () => {
        planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.PLUS,
        });
      });

      afterEach(async () => {
        await planMock?.restore();
      });

      it('should block custom sync create with ERR_FEATURE_NOT_SUPPORTED', async () => {
        const res = await attemptCustomSyncCreate().expect(403);
        expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Business plan', () => {
      let planMock: Awaited<ReturnType<typeof overridePlan>>;

      beforeEach(async () => {
        planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.BUSINESS,
        });
      });

      afterEach(async () => {
        await planMock?.restore();
      });

      it('should allow custom sync create through the feature gate', async () => {
        const res = await attemptCustomSyncCreate();
        expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Scale plan', () => {
      let planMock: Awaited<ReturnType<typeof overridePlan>>;

      beforeEach(async () => {
        planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.SCALE,
        });
      });

      afterEach(async () => {
        await planMock?.restore();
      });

      it('should allow custom sync create through the feature gate', async () => {
        const res = await attemptCustomSyncCreate();
        expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Enterprise plan', () => {
      let planMock: Awaited<ReturnType<typeof overridePlan>>;

      beforeEach(async () => {
        planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });
      });

      afterEach(async () => {
        await planMock?.restore();
      });

      it('should allow custom sync create through the feature gate', async () => {
        const res = await attemptCustomSyncCreate();
        expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Subscription-level overrides', () => {
      it('should allow custom sync on Plus when FEATURE_CUSTOM_SYNC is force-enabled', async () => {
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.PLUS,
          features: {
            [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: true,
          },
        });

        try {
          const res = await attemptCustomSyncCreate();
          expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });

      it('should block custom sync on Business when FEATURE_CUSTOM_SYNC is force-disabled', async () => {
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.BUSINESS,
          features: {
            [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: false,
          },
        });

        try {
          const res = await attemptCustomSyncCreate().expect(403);
          expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });
    });
  });
}
