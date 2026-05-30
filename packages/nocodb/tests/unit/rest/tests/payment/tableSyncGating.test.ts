import 'mocha';
import { expect } from 'chai';
import { PlanFeatureTypes, PlanTitles, TableSyncTrigger } from 'nocodb-sdk';
import request from 'supertest';
import init from '~test/init';
import { isEE } from '~test/utils/helpers';
import { overridePlan } from '~test/utils/plan.utils';
import { Base } from '~/models';
import { RootScopes } from '~/utils/globals';

/**
 * Table Sync gating tests
 *
 * Two layered feature gates protect `tableSyncCreate`:
 *   - FEATURE_TABLE_SYNC      — base (manual) table sync. Available from the
 *     first paid plan (Plus+ on cloud). Free blocks it.
 *   - FEATURE_TABLE_SYNC_AUTO — automatic / real-time sync. Business+ on
 *     cloud. Plus blocks it (manual sync still works there).
 *
 * Both gates run *before* payload validation, so we can assert them with a
 * payload that references a non-existent source:
 *   - Gated:   responds with ERR_FEATURE_NOT_SUPPORTED (403)
 *   - Allowed: responds with some other error (404 viewNotFound,
 *              400 invalidRequestBody, etc.) but never
 *              ERR_FEATURE_NOT_SUPPORTED
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
     * references a non-existent source. The feature gates run before source
     * resolution and payload validation, so a gated plan responds with
     * ERR_FEATURE_NOT_SUPPORTED (403) while an allowed plan fails downstream
     * with some other error.
     *
     * `syncTrigger` defaults to undefined — the service then defaults to
     * Realtime (automatic), exercising the FEATURE_TABLE_SYNC_AUTO gate.
     */
    function attemptTableSyncCreate(syncTrigger?: TableSyncTrigger) {
      const payload: Record<string, any> = {
        title: `Sync-${Date.now()}`,
        source_workspace_id: workspaceId,
        source_base_id: base.id,
        source_table_id: 'mxxx_nonexistent_table',
        source_view_id: 'vwxx_nonexistent_view',
      };

      if (syncTrigger) payload.sync_trigger = syncTrigger;

      return request(context.app)
        .post(tableSyncCreateUrl())
        .set('xc-auth', context.token)
        .send(payload);
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

      it('should block manual tableSyncCreate with ERR_FEATURE_NOT_SUPPORTED', async () => {
        const res = await attemptTableSyncCreate(TableSyncTrigger.Manual).expect(
          403,
        );
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

      it('should allow manual tableSyncCreate through the feature gate', async () => {
        const res = await attemptTableSyncCreate(TableSyncTrigger.Manual);
        expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
      });

      it('should block automatic tableSyncCreate with ERR_FEATURE_NOT_SUPPORTED', async () => {
        const res = await attemptTableSyncCreate(
          TableSyncTrigger.Realtime,
        ).expect(403);
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

      it('should allow automatic tableSyncCreate through the feature gate', async () => {
        const res = await attemptTableSyncCreate(TableSyncTrigger.Realtime);
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

      it('should allow automatic tableSyncCreate through the feature gate', async () => {
        const res = await attemptTableSyncCreate(TableSyncTrigger.Realtime);
        expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
      });
    });

    describe('Subscription-level overrides', () => {
      it('should allow automatic tableSyncCreate on Plus when FEATURE_TABLE_SYNC_AUTO is force-enabled', async () => {
        // Plus blocks automatic sync by default — verify a subscription
        // override can unblock it.
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.PLUS,
          features: {
            [PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO]: true,
          },
        });

        try {
          const res = await attemptTableSyncCreate(TableSyncTrigger.Realtime);
          expect(res.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });

      it('should block manual tableSyncCreate on Business when FEATURE_TABLE_SYNC is force-disabled', async () => {
        // Business allows by default — verify a subscription override can block
        // even manual sync via the base feature gate.
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.BUSINESS,
          features: {
            [PlanFeatureTypes.FEATURE_TABLE_SYNC]: false,
          },
        });

        try {
          const res = await attemptTableSyncCreate(
            TableSyncTrigger.Manual,
          ).expect(403);
          expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });

      it('should block automatic tableSyncCreate on Business when FEATURE_TABLE_SYNC_AUTO is force-disabled', async () => {
        // Business allows automatic by default — verify a subscription override
        // can block just the automatic tier while manual still works.
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.BUSINESS,
          features: {
            [PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO]: false,
          },
        });

        try {
          const blocked = await attemptTableSyncCreate(
            TableSyncTrigger.Realtime,
          ).expect(403);
          expect(blocked.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');

          const allowed = await attemptTableSyncCreate(TableSyncTrigger.Manual);
          expect(allowed.body.error).to.not.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });
    });
  });
}
