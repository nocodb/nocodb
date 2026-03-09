import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { createUser } from '../../../../factory/user';

/**
 * Document Permissions tests — verifies:
 * 1. Only owners/creators can configure document permissions
 * 2. Document visibility permission restricts who can see a document
 * 3. Document edit permission restricts who can edit a document
 * 4. Inheritance: child inherits parent's effective permission
 * 5. Restrict-only: child cannot be more permissive than parent
 * 6. Cascade tighten: when parent is tightened, children auto-tighten
 */
export const documentPermissionsTests = function () {
  if (!isEE()) {
    return;
  }

  describe('Document Permissions', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;

    let ownerToken: string;
    let creatorToken: string;
    let editorToken: string;
    let viewerToken: string;

    let rootDocId: string;
    let childDocId: string;
    let grandchildDocId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
      ownerToken = context.token;

      // Create a base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-auth', ownerToken)
        .send({ title: 'DocPermTestBase' })
        .expect(200);

      baseId = baseResult.body.id;
      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      // Create users with different roles
      const creator = await createUser(
        { app: context.app },
        { email: 'creator@docperm.com', password: 'Test1234!' },
      );
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-auth', ownerToken)
        .send({
          email: 'creator@docperm.com',
          workspace_role: 'workspace-level-creator',
        })
        .expect(200);
      creatorToken = creator.token;

      const editor = await createUser(
        { app: context.app },
        { email: 'editor@docperm.com', password: 'Test1234!' },
      );
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-auth', ownerToken)
        .send({
          email: 'editor@docperm.com',
          workspace_role: 'workspace-level-editor',
        })
        .expect(200);
      editorToken = editor.token;

      const viewer = await createUser(
        { app: context.app },
        { email: 'viewer@docperm.com', password: 'Test1234!' },
      );
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-auth', ownerToken)
        .send({
          email: 'viewer@docperm.com',
          workspace_role: 'workspace-level-viewer',
        })
        .expect(200);
      viewerToken = viewer.token;

      // Create document hierarchy: root -> child -> grandchild
      const rootRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'documentCreate' })
        .set('xc-auth', ownerToken)
        .send({
          title: 'Root Doc',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        })
        .expect(200);
      rootDocId = rootRes.body.id;

      const childRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'documentCreate' })
        .set('xc-auth', ownerToken)
        .send({
          title: 'Child Doc',
          parent_id: rootDocId,
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        })
        .expect(200);
      childDocId = childRes.body.id;

      const grandchildRes = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'documentCreate' })
        .set('xc-auth', ownerToken)
        .send({
          title: 'Grandchild Doc',
          parent_id: childDocId,
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        })
        .expect(200);
      grandchildDocId = grandchildRes.body.id;
    });

    // Helper to set a document permission
    const setDocPermission = async (
      token: string,
      docId: string,
      permissionKey: PermissionKey,
      grantedType: PermissionGrantedType,
      grantedRole?: PermissionRole,
      expectedStatus = 200,
    ) => {
      return request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'setPermission' })
        .set('xc-auth', token)
        .send({
          entity: PermissionEntity.DOCUMENT,
          entity_id: docId,
          permission: permissionKey,
          granted_type: grantedType,
          granted_role: grantedRole,
        })
        .expect(expectedStatus);
    };

    // Helper to drop a document permission
    const dropDocPermission = async (
      token: string,
      docId: string,
      permissionKey: PermissionKey,
      expectedStatus = 200,
    ) => {
      return request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'dropPermission' })
        .set('xc-auth', token)
        .send({
          entity: PermissionEntity.DOCUMENT,
          entity_id: docId,
          permission: permissionKey,
        })
        .expect(expectedStatus);
    };

    // Helper to list documents
    const listDocs = async (token: string, parentId: string | null = null) => {
      return request(context.app)
        .get(INTERNAL_API_BASE)
        .query({
          operation: 'documentList',
          parent_id: parentId === null ? 'null' : parentId,
        })
        .set('xc-auth', token)
        .expect(200);
    };

    // Helper to get a single document
    const getDoc = async (token: string, docId: string) => {
      return request(context.app)
        .get(INTERNAL_API_BASE)
        .query({ operation: 'documentGet', docId })
        .set('xc-auth', token);
    };

    // Helper to update a document
    const updateDoc = async (
      token: string,
      docId: string,
      payload: Record<string, any>,
    ) => {
      return request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'documentUpdate' })
        .set('xc-auth', token)
        .send({ docId, ...payload });
    };

    // ─── Permission Configuration Access Control ──────────────────────

    describe('Permission Configuration Access Control', () => {
      it('Owner can set document visibility permission', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );
      });

      it('Creator can set document visibility permission', async () => {
        await setDocPermission(
          creatorToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );
      });

      it('Editor cannot set document permissions', async () => {
        await setDocPermission(
          editorToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
          403,
        );
      });

      it('Viewer cannot set document permissions', async () => {
        await setDocPermission(
          viewerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
          403,
        );
      });

      it('Owner can set document edit permission', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );
      });

      it('Creator can drop document permission', async () => {
        // First set permission as owner
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Creator should be able to drop it
        await dropDocPermission(
          creatorToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
        );
      });

      it('Editor cannot drop document permissions', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        await dropDocPermission(
          editorToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          403,
        );
      });
    });

    // ─── Document Visibility ─────────────────────────────────────────

    describe('Document Visibility', () => {
      it('All users can see documents by default (no permission set)', async () => {
        const ownerList = await listDocs(ownerToken);
        expect(ownerList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        const viewerList = await listDocs(viewerToken);
        expect(viewerList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );
      });

      it('EDITORS_AND_UP visibility hides document from viewers', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Editor should still see the document
        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Viewer should NOT see the document
        const viewerList = await listDocs(viewerToken);
        expect(viewerList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );
      });

      it('CREATORS_AND_UP visibility hides document from editors and viewers', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Creator should see the document
        const creatorList = await listDocs(creatorToken);
        expect(creatorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Editor should NOT see the document
        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );
      });

      it('Visibility check applies to documentGet as well', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Creator can get the document
        const creatorGet = await getDoc(creatorToken, rootDocId);
        expect(creatorGet.status).to.equal(200);

        // Viewer cannot (returns 404 — hidden)
        const viewerGet = await getDoc(viewerToken, rootDocId);
        expect(viewerGet.status).to.equal(404);
      });

      it('NOBODY visibility hides document from everyone except owner', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.NOBODY,
        );

        // Owner should still see the document (base owner bypass)
        const ownerGet = await getDoc(ownerToken, rootDocId);
        expect(ownerGet.status).to.equal(200);

        // Creator should NOT see the document
        const creatorGet = await getDoc(creatorToken, rootDocId);
        expect(creatorGet.status).to.equal(404);
      });
    });

    // ─── Document Edit ────────────────────────────────────────────────

    describe('Document Edit Permission', () => {
      it('CREATORS_AND_UP edit permission blocks editor from updating', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Get current version
        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        // Editor should be forbidden from updating
        const editorUpdate = await updateDoc(editorToken, rootDocId, {
          title: 'Editor Edit Attempt',
          version,
        });
        expect(editorUpdate.status).to.equal(403);

        // Creator should be able to update
        const creatorUpdate = await updateDoc(creatorToken, rootDocId, {
          title: 'Creator Edit',
          version,
        });
        expect(creatorUpdate.status).to.equal(200);
      });

      it('NOBODY edit permission blocks all users except owner', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.NOBODY,
        );

        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        // Creator should be forbidden
        const creatorUpdate = await updateDoc(creatorToken, rootDocId, {
          title: 'Creator Edit Attempt',
          version,
        });
        expect(creatorUpdate.status).to.equal(403);
      });
    });

    // ─── Inheritance ──────────────────────────────────────────────────

    describe('Permission Inheritance', () => {
      it('Child inherits parent visibility permission', async () => {
        // Set root doc to CREATORS_AND_UP visibility
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Editor should NOT see child doc (inherits root restriction)
        const editorChildren = await listDocs(editorToken, rootDocId);
        expect(editorChildren.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === childDocId),
        );

        // Creator should see child doc
        const creatorChildren = await listDocs(creatorToken, rootDocId);
        expect(creatorChildren.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === childDocId),
        );
      });

      it('Grandchild inherits through parent chain', async () => {
        // Set root doc to EDITORS_AND_UP visibility
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Viewer should NOT see grandchild (inherits from root through child)
        const viewerGrandchildren = await listDocs(viewerToken, childDocId);
        expect(viewerGrandchildren.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === grandchildDocId),
        );

        // Editor should see grandchild
        const editorGrandchildren = await listDocs(editorToken, childDocId);
        expect(editorGrandchildren.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === grandchildDocId),
        );
      });

      it('Child can be more restrictive than parent', async () => {
        // Root: EDITORS_AND_UP
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Child: CREATORS_AND_UP (more restrictive — should succeed)
        await setDocPermission(
          ownerToken,
          childDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Editor can see root but not child
        const editorRoot = await listDocs(editorToken);
        expect(editorRoot.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        const editorChildren = await listDocs(editorToken, rootDocId);
        expect(editorChildren.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === childDocId),
        );
      });
    });

    // ─── Restrict-Only Enforcement ────────────────────────────────────

    describe('Restrict-Only Enforcement', () => {
      it('Cannot set child more permissive than parent', async () => {
        // Root: CREATORS_AND_UP
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Child: EDITORS_AND_UP (more permissive — should fail)
        await setDocPermission(
          ownerToken,
          childDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
          403,
        );
      });

      it('Cannot set grandchild more permissive than inherited parent restriction', async () => {
        // Root: EDITORS_AND_UP
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Grandchild (inherits EDITORS_AND_UP from root through child):
        // Setting to EVERYONE should fail
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'setPermission' })
          .set('xc-auth', ownerToken)
          .send({
            entity: PermissionEntity.DOCUMENT,
            entity_id: grandchildDocId,
            permission: PermissionKey.DOCUMENT_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(403);
      });

      it('Same restrictiveness as parent is allowed', async () => {
        // Root: EDITORS_AND_UP
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Child: EDITORS_AND_UP (same level — should succeed)
        await setDocPermission(
          ownerToken,
          childDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );
      });
    });

    // ─── Cascade Tighten ──────────────────────────────────────────────

    describe('Cascade Tighten', () => {
      it('Tightening parent removes more-permissive child explicit permissions', async () => {
        // Set child to EDITORS_AND_UP explicitly
        await setDocPermission(
          ownerToken,
          childDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        // Now set root to CREATORS_AND_UP (more restrictive than child)
        // This should cascade-tighten the child
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Editor should NOT see child (child's explicit EDITORS_AND_UP was removed,
        // now inherits root's CREATORS_AND_UP)
        const editorChildren = await listDocs(editorToken, rootDocId);
        expect(editorChildren.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === childDocId),
        );
      });
    });

    // ─── Edit Permission on Delete/Reorder ────────────────────────────

    describe('Edit Permission Guards Delete and Reorder', () => {
      it('CREATORS_AND_UP edit blocks editor from deleting', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        const deleteRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentDelete' })
          .set('xc-auth', editorToken)
          .send({ docId: rootDocId });

        expect(deleteRes.status).to.equal(403);
      });

      it('CREATORS_AND_UP edit blocks editor from reordering', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        const reorderRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentReorder' })
          .set('xc-auth', editorToken)
          .send({ docId: rootDocId, order: 999 });

        expect(reorderRes.status).to.equal(403);
      });
    });
  });
};
