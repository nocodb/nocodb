import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const filtersSortsHooksGetTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Filters, Sorts & Hooks GET', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let titleColumnId: string;
    let filterId: string;
    let sortId: string;
    let hookId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'FiltersSortsHooksTestBase' })
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
          title: 'FilterSortHookTable',
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

      // Get default view
      const viewListRes = await request(context.app)
        .get(INTERNAL_API_BASE)
        .query({ operation: 'viewList', tableId: table.id })
        .set('xc-token', context.xc_token)
        .expect(200);

      defaultViewId = viewListRes.body.list[0].id;

      // Get title column
      const columns = await table.getColumns(ctx);
      const titleColumn = columns.find((col: any) => col.title === 'Title');
      titleColumnId = titleColumn.id;

      // Create a filter
      const filterRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'filterCreate', viewId: defaultViewId })
        .set('xc-token', context.xc_token)
        .send({
          fk_column_id: titleColumnId,
          comparison_op: 'eq',
          value: 'test',
        })
        .expect(200);

      filterId = filterRes.body.id;

      // Create a sort
      const sortRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'sortCreate', viewId: defaultViewId })
        .set('xc-token', context.xc_token)
        .send({
          fk_column_id: titleColumnId,
          direction: 'asc',
        })
        .expect(200);

      sortId = sortRes.body.id;

      // Create a hook (version: 'v3' required by SUPPORTED_HOOK_VERSION)
      const hookRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'hookCreate', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({
          title: 'TestHook',
          event: 'after',
          operation: ['insert'],
          version: 'v3',
          notification: {
            type: 'URL',
            payload: {
              method: 'POST',
              body: '{{ json data }}',
              headers: [{}],
              parameters: [{}],
              path: 'https://example.com/webhook',
            },
          },
        })
        .expect(200);

      hookId = hookRes.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── filterList ────────────────────────────────────────────────────

    describe('filterList (GET)', () => {
      it('should list filters for a view', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'filterList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return filter with correct structure', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'filterList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        const filter = response.body.list[0];
        expect(filter).to.have.property('id');
        expect(filter).to.have.property('fk_column_id');
        expect(filter).to.have.property('comparison_op');
      });

      it('should support includeAllFilters param', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'filterList',
            viewId: defaultViewId,
            includeAllFilters: 'true',
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
      });
    });

    // ── filterChildrenList ────────────────────────────────────────────

    describe('filterChildrenList (GET)', () => {
      it('should return children list for a filter', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'filterChildrenList', filterId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        // No children created, so list should be empty
        expect(response.body.list.length).to.eq(0);
      });
    });

    // ── sortList ──────────────────────────────────────────────────────

    describe('sortList (GET)', () => {
      it('should list sorts for a view', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'sortList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return sort with correct structure', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'sortList', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .expect(200);

        const sort = response.body.list[0];
        expect(sort).to.have.property('id');
        expect(sort).to.have.property('fk_column_id');
        expect(sort).to.have.property('direction');
      });
    });

    // ── hookList ──────────────────────────────────────────────────────

    describe('hookList (GET)', () => {
      it('should list hooks for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'hookList', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should return hook with correct structure', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'hookList', tableId: table.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        const hook = response.body.list[0];
        expect(hook).to.have.property('id');
        expect(hook).to.have.property('title');
        expect(hook).to.have.property('event');
        expect(hook).to.have.property('operation');
      });

      it('should return 404 with invalid tableId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'hookList', tableId: 'invalid-table-id' })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    // ── hookLogList ───────────────────────────────────────────────────

    describe('hookLogList (GET)', () => {
      it('should return hook log list (possibly empty)', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'hookLogList', hookId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
      });
    });

    // ── hookFilterList ────────────────────────────────────────────────

    describe('hookFilterList (GET)', () => {
      it('should return hook filter list (initially empty)', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'hookFilterList', hookId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
      });

      it('should list hook filters after adding one', async () => {
        // Create a hook filter
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookFilterCreate', hookId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(200);

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'hookFilterList', hookId })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body.list.length).to.be.greaterThan(0);
      });
    });

    // ── hookSamplePayload ─────────────────────────────────────────────

    describe('hookSamplePayload (GET)', () => {
      it('should return sample payload for a hook', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'hookSamplePayload',
            tableId: table.id,
            hookOperation: 'insert',
            version: 'v2',
            event: 'after',
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
      });
    });

    // ── tableSampleData ───────────────────────────────────────────────

    describe('tableSampleData (GET)', () => {
      it('should return sample data for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'tableSampleData',
            tableId: table.id,
            hookOperation: 'insert',
            version: 'v2',
            event: 'after',
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
      });
    });
  });
};
