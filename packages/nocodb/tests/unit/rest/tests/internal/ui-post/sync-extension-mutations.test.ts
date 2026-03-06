import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const syncExtensionMutationTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - Sync Source & Extension Mutations (POST)', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let sourceId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'SyncExtBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Get source ID
      const sources = await initBase.getSources();
      sourceId = sources[0].id;

      // Create table
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'SyncExtTable',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        })
        .expect(200);

      // Get table model
      ctx = { base_id: initBase.id, workspace_id: workspaceId };
      table = await Model.getByAliasOrId(ctx, {
        source_id: sourceId,
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
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ── syncSourceCreate ────────────────────────────────────────────

    describe('syncSourceCreate (POST)', () => {
      it('should create a sync source', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceCreate', sourceId })
          .set('xc-token', context.xc_token)
          .send({
            type: 'Airtable',
            details: { syncSourceUrlOrId: 'https://airtable.com/test' },
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body).to.have.property('id');
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceCreate', sourceId })
          .send({
            type: 'Airtable',
            details: { syncSourceUrlOrId: 'https://airtable.com/test' },
          })
          .expect(401);
      });
    });

    // ── syncSourceUpdate ────────────────────────────────────────────

    describe('syncSourceUpdate (POST)', () => {
      it('should update a sync source', async () => {
        // Create sync source first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceCreate', sourceId })
          .set('xc-token', context.xc_token)
          .send({
            type: 'Airtable',
            details: { syncSourceUrlOrId: 'https://airtable.com/test' },
          })
          .expect(200);

        const syncId = createRes.body.id;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceUpdate', syncId })
          .set('xc-token', context.xc_token)
          .send({
            details: { syncSourceUrlOrId: 'https://airtable.com/updated' },
          })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceCreate', sourceId })
          .set('xc-token', context.xc_token)
          .send({
            type: 'Airtable',
            details: { syncSourceUrlOrId: 'https://airtable.com/test' },
          })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceUpdate', syncId: createRes.body.id })
          .send({ details: {} })
          .expect(401);
      });
    });

    // ── syncSourceDelete ────────────────────────────────────────────

    describe('syncSourceDelete (POST)', () => {
      it('should delete a sync source', async () => {
        // Create sync source first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceCreate', sourceId })
          .set('xc-token', context.xc_token)
          .send({
            type: 'Airtable',
            details: { syncSourceUrlOrId: 'https://airtable.com/del' },
          })
          .expect(200);

        const syncId = createRes.body.id;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceDelete', syncId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceCreate', sourceId })
          .set('xc-token', context.xc_token)
          .send({
            type: 'Airtable',
            details: { syncSourceUrlOrId: 'https://airtable.com/auth' },
          })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'syncSourceDelete', syncId: createRes.body.id })
          .send({})
          .expect(401);
      });
    });

    // ── extensionUpdate ─────────────────────────────────────────────

    describe('extensionUpdate (POST)', () => {
      it('should update an extension', async () => {
        // Create extension first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'extensionCreate' })
          .set('xc-token', context.xc_token)
          .send({
            title: 'TestExt',
            extension_id: 'test-ext-id',
            base_id: baseId,
          })
          .expect(200);

        const extensionId = createRes.body.id;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'extensionUpdate', extensionId })
          .set('xc-token', context.xc_token)
          .send({ title: 'UpdatedExt' })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'extensionCreate' })
          .set('xc-token', context.xc_token)
          .send({
            title: 'AuthExt',
            extension_id: 'auth-ext-id',
            base_id: baseId,
          })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'extensionUpdate',
            extensionId: createRes.body.id,
          })
          .send({ title: 'Fail' })
          .expect(401);
      });
    });

    // ── extensionDelete ─────────────────────────────────────────────

    describe('extensionDelete (POST)', () => {
      it('should delete an extension', async () => {
        // Create extension first
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'extensionCreate' })
          .set('xc-token', context.xc_token)
          .send({
            title: 'DeleteExt',
            extension_id: 'del-ext-id',
            base_id: baseId,
          })
          .expect(200);

        const extensionId = createRes.body.id;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'extensionDelete', extensionId })
          .set('xc-token', context.xc_token)
          .send({})
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'extensionCreate' })
          .set('xc-token', context.xc_token)
          .send({
            title: 'AuthDelExt',
            extension_id: 'auth-del-ext-id',
            base_id: baseId,
          })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'extensionDelete',
            extensionId: createRes.body.id,
          })
          .send({})
          .expect(401);
      });
    });
  });
};
