import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const commentMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Comment Mutations (POST)', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let defaultViewId: string;
    let rowId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'CommentMutBase' })
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
          title: 'CommentMutTable',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
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

      // Insert a row
      const insertRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({
          operation: 'dataInsert',
          tableId: table.id,
          viewId: defaultViewId,
        })
        .set('xc-token', context.xc_token)
        .send({ Title: 'CommentTestRow' })
        .expect(200);

      rowId = String(insertRes.body.Id ?? insertRes.body.id ?? '1');
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // Helper: create a comment and return its ID
    async function createComment(comment: string) {
      const res = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'commentRow' })
        .set('xc-token', context.xc_token)
        .send({
          fk_model_id: table.id,
          row_id: rowId,
          comment,
        })
        .expect(200);
      return res.body.id;
    }

    // ── commentRow ──────────────────────────────────────────────────

    describe('commentRow (POST)', () => {
      it('should create a comment on a row', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentRow' })
          .set('xc-token', context.xc_token)
          .send({
            fk_model_id: table.id,
            row_id: rowId,
            comment: 'Test comment',
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentRow' })
          .send({
            fk_model_id: table.id,
            row_id: rowId,
            comment: 'Fail',
          })
          .expect(401);
      });
    });

    // ── commentUpdate ───────────────────────────────────────────────

    describe('commentUpdate (POST)', () => {
      it('should update an existing comment', async () => {
        const commentId = await createComment('Original comment');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentUpdate' })
          .set('xc-token', context.xc_token)
          .send({ commentId, comment: 'Updated comment' })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const commentId = await createComment('Auth test comment');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentUpdate' })
          .send({ commentId, comment: 'Fail' })
          .expect(401);
      });
    });

    // ── commentDelete ───────────────────────────────────────────────

    describe('commentDelete (POST)', () => {
      it('should delete a comment', async () => {
        const commentId = await createComment('Delete me');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentDelete' })
          .set('xc-token', context.xc_token)
          .send({ commentId })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const commentId = await createComment('Auth delete test');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentDelete' })
          .send({ commentId })
          .expect(401);
      });
    });

    // ── commentResolve ──────────────────────────────────────────────

    describe('commentResolve (POST)', () => {
      it('should resolve a comment', async () => {
        const commentId = await createComment('Resolve me');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentResolve' })
          .set('xc-token', context.xc_token)
          .send({ commentId })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const commentId = await createComment('Auth resolve test');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'commentResolve' })
          .send({ commentId })
          .expect(401);
      });
    });
  });
};
