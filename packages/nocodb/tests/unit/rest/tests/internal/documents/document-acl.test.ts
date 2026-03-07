import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { createUser } from '../../../../factory/user';

/**
 * Document ACL tests — verifies role-based access control for document operations.
 *
 * ACL matrix (from ee/utils/acl.ts):
 *   Viewer:   documentList, documentGet
 *   Editor:   + documentUpdate, documentReorder
 *   Creator+: + documentCreate, documentDelete
 */
export const documentAclTests = function () {
  if (!isEE()) {
    return;
  }

  describe('Document ACL', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;

    // Tokens for different roles
    let ownerToken: string;
    let viewerToken: string;
    let editorToken: string;

    // A document created by the owner for read/update/delete tests
    let seedDocId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
      ownerToken = context.token;

      // Create a base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-auth', ownerToken)
        .send({ title: 'DocAclTestBase' })
        .expect(200);

      baseId = baseResult.body.id;
      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      // Create viewer user
      const viewer = await createUser(
        { app: context.app },
        { email: 'viewer@acl-test.com', password: 'Test1234!' },
      );
      // Invite viewer to workspace
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-auth', ownerToken)
        .send({
          email: 'viewer@acl-test.com',
          workspace_role: 'workspace-level-viewer',
        })
        .expect(200);
      viewerToken = viewer.token;

      // Create editor user
      const editor = await createUser(
        { app: context.app },
        { email: 'editor@acl-test.com', password: 'Test1234!' },
      );
      // Invite editor to workspace
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-auth', ownerToken)
        .send({
          email: 'editor@acl-test.com',
          workspace_role: 'workspace-level-editor',
        })
        .expect(200);
      editorToken = editor.token;

      // Seed a document as owner for subsequent tests
      const createRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'documentCreate' })
        .set('xc-auth', ownerToken)
        .send({ title: 'Seed Doc', content: { type: 'doc', content: [{ type: 'paragraph' }] } })
        .expect(200);

      seedDocId = createRes.body.id;
    });

    // ── Viewer role ──────────────────────────────────────────────────

    describe('Viewer role', () => {
      it('should allow documentList', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentList', parent_id: 'null' })
          .set('xc-auth', viewerToken)
          .expect(200);
      });

      it('should allow documentGet', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentGet', docId: seedDocId })
          .set('xc-auth', viewerToken)
          .expect(200);
      });

      it('should deny documentCreate', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', viewerToken)
          .send({ title: 'Viewer Create Attempt' });

        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('should deny documentUpdate', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentUpdate' })
          .set('xc-auth', viewerToken)
          .send({ docId: seedDocId, title: 'Viewer Update', version: 1 });

        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('should deny documentDelete', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentDelete' })
          .set('xc-auth', viewerToken)
          .send({ docId: seedDocId });

        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('should deny documentReorder', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentReorder' })
          .set('xc-auth', viewerToken)
          .send({ docId: seedDocId, order: 10 });

        expect(res.status).to.be.oneOf([401, 403]);
      });
    });

    // ── Editor role ──────────────────────────────────────────────────

    describe('Editor role', () => {
      it('should allow documentList', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentList', parent_id: 'null' })
          .set('xc-auth', editorToken)
          .expect(200);
      });

      it('should allow documentGet', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentGet', docId: seedDocId })
          .set('xc-auth', editorToken)
          .expect(200);
      });

      it('should deny documentCreate', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', editorToken)
          .send({ title: 'Editor Create Attempt' });

        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('should allow documentUpdate', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentUpdate' })
          .set('xc-auth', editorToken)
          .send({ docId: seedDocId, title: 'Editor Updated', version: 1 })
          .expect(200);
      });

      it('should deny documentDelete', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentDelete' })
          .set('xc-auth', editorToken)
          .send({ docId: seedDocId });

        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('should allow documentReorder', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentReorder' })
          .set('xc-auth', editorToken)
          .send({ docId: seedDocId, order: 50 })
          .expect(200);
      });
    });

    // ── Creator / Owner role ─────────────────────────────────────────

    describe('Owner role (Creator+)', () => {
      it('should allow documentList', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentList', parent_id: 'null' })
          .set('xc-auth', ownerToken)
          .expect(200);
      });

      it('should allow documentGet', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentGet', docId: seedDocId })
          .set('xc-auth', ownerToken)
          .expect(200);
      });

      it('should allow documentCreate', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', ownerToken)
          .send({ title: 'Owner Created' })
          .expect(200);
      });

      it('should allow documentUpdate', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentUpdate' })
          .set('xc-auth', ownerToken)
          .send({ docId: seedDocId, title: 'Owner Updated', version: 1 })
          .expect(200);
      });

      it('should allow documentDelete', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentDelete' })
          .set('xc-auth', ownerToken)
          .send({ docId: seedDocId })
          .expect(200);
      });

      it('should allow documentReorder', async () => {
        // Create a fresh doc (seed may be deleted by previous test)
        const doc = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', ownerToken)
          .send({ title: 'Reorder Me' })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentReorder' })
          .set('xc-auth', ownerToken)
          .send({ docId: doc.body.id, order: 99 })
          .expect(200);
      });
    });

    // ── Unauthenticated ──────────────────────────────────────────────

    describe('Unauthenticated', () => {
      it('should deny documentList without auth', async () => {
        const res = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'documentList', parent_id: 'null' });

        expect(res.status).to.be.oneOf([401, 403]);
      });

      it('should deny documentCreate without auth', async () => {
        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .send({ title: 'No Auth' });

        expect(res.status).to.be.oneOf([401, 403]);
      });
    });
  });
};
