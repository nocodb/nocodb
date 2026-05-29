import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk';
import init from '~test/init';
import { isEE } from '~test/utils/helpers';
import { overridePlan } from '~test/utils/plan.utils';
import { Base } from '~/models';
import { RootScopes } from '~/utils/globals';

/**
 * Table Sync (FEATURE_TABLE_SYNC) gating tests
 *
 * Table sync is gated at the Business tier on cloud — Free and Plus block
 * it, Business and Enterprise allow it. This file exercises the
 * `tableSyncCreate` internal operation against
 * `checkForFeature(FEATURE_TABLE_SYNC)` at the top of the service.
 *
 * Each "allow" assertion only checks that the FEATURE_TABLE_SYNC gate did
 * NOT fire — the call is expected to fail downstream (no real source view
 * is provisioned) but that failure must not be ERR_FEATURE_NOT_SUPPORTED
 * from the table-sync feature gate.
 */
export function tableSyncGatingTests() {
  if (!isEE()) {
    return;
  }

  describe('Table Sync Feature Gating', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let base: any;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'TableSyncGatingTestBase' })
        .expect(200);

      base = await Base.getByTitleOrId(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        } as any,
        baseResult.body.id,
      );
    });

    function tableSyncCreateUrl() {
      return `/api/v2/internal/${workspaceId}/${base.id}?operation=tableSyncCreate`;
    }

    /**
     * Sends a tableSyncCreate request with a syntactically valid payload that
     * references a non-existent source. The feature-gate check runs *before*
     * the source-resolution code, so:
     *   - Gated:   responds with ERR_FEATURE_NOT_SUPPORTED (403)
     *   - Allowed: responds with some other error (404 viewNotFound,
     *              400 invalidRequestBody, etc.) but never
     *              ERR_FEATURE_NOT_SUPPORTED
     */
    function attemptTableSyncCreate() {
      return request(context.app)
        .post(tableSyncCreateUrl())
        .set('xc-auth', context.token)
        .send({
          title: `Sync-${Date.now()}`,
          source_workspace_id: workspaceId,
          source_base_id: base.id,
          source_table_id: 'mxxx_nonexistent_table',
          source_view_id: 'vwxx_nonexistent_view',
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

      it('should block tableSyncCreate with ERR_FEATURE_NOT_SUPPORTED', async () => {
        const res = await attemptTableSyncCreate().expect(403);
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

      it('should block tableSyncCreate with ERR_FEATURE_NOT_SUPPORTED', async () => {
        const res = await attemptTableSyncCreate().expect(403);
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

      it('should allow tableSyncCreate through the feature gate', async () => {
        const res = await attemptTableSyncCreate();
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

      it('should allow tableSyncCreate through the feature gate', async () => {
        const res = await attemptTableSyncCreate();
        expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Subscription-level overrides', () => {
      it('should allow tableSyncCreate on Plus when FEATURE_TABLE_SYNC is force-enabled', async () => {
        // Plus blocks by default — verify a subscription override can unblock.
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.PLUS,
          features: {
            [PlanFeatureTypes.FEATURE_TABLE_SYNC]: true,
          },
        });

        try {
          const res = await attemptTableSyncCreate();
          expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });

      it('should block tableSyncCreate on Business when FEATURE_TABLE_SYNC is force-disabled', async () => {
        // Business allows by default — verify a subscription override can block.
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.BUSINESS,
          features: {
            [PlanFeatureTypes.FEATURE_TABLE_SYNC]: false,
          },
        });

        try {
          const res = await attemptTableSyncCreate().expect(403);
          expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });
    });
  });
}
