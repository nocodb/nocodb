import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import { overridePlan } from '../../../utils/plan.utils';
import init from '../../../init';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

/**
 * Plan Feature Gating Tests
 *
 * For each plan tier, calls feature-gated API endpoints and verifies:
 *   - Positive: features at or below the tier return 200
 *   - Negative: features above the tier return 403 (ERR_FEATURE_NOT_SUPPORTED)
 *
 * Endpoints tested:
 *   - View Sections (BUSINESS)  — POST internal API viewSectionCreate
 *   - Timeline View (BUSINESS)  — POST internal API timelineViewCreate
 *   - V3 Views List (ENTERPRISE) — GET /api/v3/meta/bases/:baseId/tables/:tableId/views
 */
export function planGatingTests() {
  if (!isEE()) {
    return;
  }

  describe('Plan Feature Gating', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let base: any;
    let table: any;
    let tableId: string;
    let dateTimeColumnId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base via V3 API (no feature gate on base creation)
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'PlanGatingTestBase' })
        .expect(200);

      base = await Base.getByTitleOrId(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        } as any,
        baseResult.body.id,
      );

      // Create a table with a DateTime column (needed for timeline view tests)
      // Use overridePlan to enable V3 API for table creation setup
      const setupMock = await overridePlan({
        workspace_id: workspaceId,
        planTitle: PlanTitles.ENTERPRISE,
      });

      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${base.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'GatingTestTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'StartDate', type: 'DateTime' },
          ],
        })
        .expect(200);

      await setupMock.restore();

      const ctx = { base_id: base.id, workspace_id: workspaceId };
      const source = (await base.getSources())[0];
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: tableResult.body.id,
        base_id: base.id,
      });

      const columns = await table.getColumns(ctx);
      tableId = table.id;
      dateTimeColumnId = columns.find((c: any) => c.title === 'StartDate').id;
    });

    // -- Helpers ----------------------------------------------------------

    function internalUrl(operation: string, extra = '') {
      return `/api/v2/internal/${workspaceId}/${base.id}?operation=${operation}${extra}`;
    }

    async function createViewSection(expectedStatus: number) {
      return request(context.app)
        .post(internalUrl('viewSectionCreate', `&tableId=${tableId}`))
        .set('xc-auth', context.token)
        .send({ title: `Section-${Date.now()}` })
        .expect(expectedStatus);
    }

    async function createTimelineView(expectedStatus: number) {
      return request(context.app)
        .post(internalUrl('timelineViewCreate', `&tableId=${tableId}`))
        .set('xc-auth', context.token)
        .send({
          title: `Timeline-${Date.now()}`,
          timeline_range: [{ fk_from_column_id: dateTimeColumnId }],
        })
        .expect(expectedStatus);
    }

    async function listV3Views(expectedStatus: number) {
      return request(context.app)
        .get(`/api/v3/meta/bases/${base.id}/tables/${tableId}/views`)
        .set('xc-auth', context.token)
        .expect(expectedStatus);
    }

    // -- Plan-tier tests --------------------------------------------------

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

      it('should block view section creation (Business feature)', async () => {
        const res = await createViewSection(403);
        expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
      });

      it('should block timeline view creation (Business feature)', async () => {
        const res = await createTimelineView(403);
        expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
      });

      it('should block V3 views API (Enterprise feature)', async () => {
        const res = await listV3Views(403);
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

      it('should allow view section creation (Business feature)', async () => {
        const res = await createViewSection(200);
        expect(res.body).to.have.property('id');
      });

      it('should allow timeline view creation (Business feature)', async () => {
        const res = await createTimelineView(200);
        expect(res.body).to.have.property('id');
      });

      it('should block V3 views API (Enterprise feature)', async () => {
        const res = await listV3Views(403);
        expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
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

      it('should allow view section creation', async () => {
        const res = await createViewSection(200);
        expect(res.body).to.have.property('id');
      });

      it('should allow timeline view creation', async () => {
        const res = await createTimelineView(200);
        expect(res.body).to.have.property('id');
      });

      it('should allow V3 views API', async () => {
        const res = await listV3Views(200);
        expect(res.body).to.have.property('list');
      });
    });

    describe('Subscription-level overrides', () => {
      it('should allow a blocked feature when overridden via subscription plan_meta', async () => {
        // Plus plan blocks FEATURE_VIEW_SECTIONS (Business feature)
        // but subscription override enables it
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.PLUS,
          features: {
            [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: true,
          },
        });

        try {
          const res = await createViewSection(200);
          expect(res.body).to.have.property('id');
        } finally {
          await planMock.restore();
        }
      });

      it('should block an otherwise-available feature when overridden to false', async () => {
        // Enterprise plan has all features, but subscription override disables one
        const planMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
          features: {
            [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,
          },
        });

        try {
          const res = await createViewSection(403);
          expect(res.body.error).to.eq('ERR_FEATURE_NOT_SUPPORTED');
        } finally {
          await planMock.restore();
        }
      });
    });
  });
}
