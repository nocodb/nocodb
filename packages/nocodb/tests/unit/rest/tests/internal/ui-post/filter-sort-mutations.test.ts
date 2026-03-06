import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const filterSortMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Filter & Sort Mutations (POST)', () => {
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
    let hookId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'FilterSortMutTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Create table with fields
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'FilterSortMutTable',
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

      // Create a hook for hookFilterCreate test
      const hookRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'hookCreate', tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({
          title: 'FilterTestHook',
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

    // ── filterCreate ────────────────────────────────────────────────

    describe('filterCreate (POST)', () => {
      it('should create a filter', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'filterCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'filterCreate', viewId: defaultViewId })
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(401);
      });
    });

    // ── filterUpdate ────────────────────────────────────────────────

    describe('filterUpdate (POST)', () => {
      it('should update a filter', async () => {
        // Create a filter first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'filterCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'original',
          })
          .expect(200);

        const filterId = createRes.body.id;

        // Then update it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'filterUpdate', filterId })
          .set('xc-token', context.xc_token)
          .send({ comparison_op: 'neq', value: 'updated' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── filterDelete ────────────────────────────────────────────────

    describe('filterDelete (POST)', () => {
      it('should delete a filter', async () => {
        // Create a filter first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'filterCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'deleteme',
          })
          .expect(200);

        const filterId = createRes.body.id;

        // Then delete it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'filterDelete', filterId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });
    });

    // ── sortCreate ──────────────────────────────────────────────────

    describe('sortCreate (POST)', () => {
      it('should create a sort', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'sortCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            direction: 'asc',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });
    });

    // ── sortUpdate ──────────────────────────────────────────────────

    describe('sortUpdate (POST)', () => {
      it('should update a sort', async () => {
        // Create a sort first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'sortCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            direction: 'asc',
          })
          .expect(200);

        const sortId = createRes.body.id;

        // Then update it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'sortUpdate', sortId })
          .set('xc-token', context.xc_token)
          .send({ direction: 'desc' })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── sortDelete ──────────────────────────────────────────────────

    describe('sortDelete (POST)', () => {
      it('should delete a sort', async () => {
        // Create a sort first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'sortCreate', viewId: defaultViewId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            direction: 'asc',
          })
          .expect(200);

        const sortId = createRes.body.id;

        // Then delete it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'sortDelete', sortId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });
    });

    // ── hookFilterCreate ────────────────────────────────────────────

    describe('hookFilterCreate (POST)', () => {
      it('should create a hook filter', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookFilterCreate', hookId })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumnId,
            comparison_op: 'eq',
            value: 'hooktest',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });
    });
  });
};
