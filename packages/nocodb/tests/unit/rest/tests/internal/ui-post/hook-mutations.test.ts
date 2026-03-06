import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const hookMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Hook Mutations (POST)', () => {
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

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'HookMutTestBase' })
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
          title: 'HookMutTable',
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
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── hookCreate ──────────────────────────────────────────────────

    describe('hookCreate (POST)', () => {
      it('should create a hook', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'NewHook',
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

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
        expect(response.body).to.have.property('title', 'NewHook');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookCreate', tableId: table.id })
          .send({
            title: 'FailHook',
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
          .expect(401);
      });
    });

    // ── hookUpdate ──────────────────────────────────────────────────

    describe('hookUpdate (POST)', () => {
      it('should update a hook', async () => {
        // Create a hook first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'UpdateMeHook',
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

        const hookId = createRes.body.id;

        // Then update it (send full hook payload — partial update may fail)
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookUpdate', hookId })
          .set('xc-token', context.xc_token)
          .send({
            title: 'UpdatedHook',
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

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── hookDelete ──────────────────────────────────────────────────

    describe('hookDelete (POST)', () => {
      it('should delete a hook', async () => {
        // Create a hook first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'DeleteMeHook',
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

        const hookId = createRes.body.id;

        // Then delete it
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookDelete', hookId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });
    });

    // ── hookTest ────────────────────────────────────────────────────

    describe('hookTest (POST)', () => {
      it('should test a hook', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookTest', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            hook: {
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
            },
            payload: {},
          })
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });

    // ── hookTrigger ─────────────────────────────────────────────────

    describe('hookTrigger (POST)', () => {
      it.skip('should trigger a hook for a specific row (skipped: webhook URL unreachable in test env causes timeout)', async () => {
        // Create a hook first
        const hookRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({
            title: 'TriggerHook',
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

        const hookId = hookRes.body.id;

        // Insert a row via dataInsert
        const rowRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'dataInsert',
            tableId: table.id,
            viewId: defaultViewId,
          })
          .set('xc-token', context.xc_token)
          .send({ Title: 'TestRow' })
          .expect(200);

        const rowId = rowRes.body.Id;

        // Trigger the hook
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'hookTrigger', hookId, rowId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.body).to.not.be.undefined;
      });
    });
  });
};
