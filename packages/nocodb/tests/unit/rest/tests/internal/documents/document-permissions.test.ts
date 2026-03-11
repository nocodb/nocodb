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

    let ownerId: string;
    let creatorId: string;
    let editorId: string;
    let viewerId: string;

    let rootDocId: string;
    let childDocId: string;
    let grandchildDocId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
      ownerToken = context.token;
      ownerId = context.user.id;

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
      creatorId = creator.user.id;

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
      editorId = editor.user.id;

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
      viewerId = viewer.user.id;

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
      subjects?: { type: 'user' | 'team'; id: string; hierarchy_scope?: string }[],
    ) => {
      const body: Record<string, any> = {
        entity: PermissionEntity.DOCUMENT,
        entity_id: docId,
        permission: permissionKey,
        granted_type: grantedType,
        granted_role: grantedRole,
      };
      if (subjects) {
        body.subjects = subjects;
      }
      return request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'setPermission' })
        .set('xc-auth', token)
        .send(body)
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

    // ─── Default Edit Permission ──────────────────────────────────────

    describe('Default Edit Permission (Editors & up)', () => {
      it('Editor can edit documents by default (no explicit permission set)', async () => {
        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        const editorUpdate = await updateDoc(editorToken, rootDocId, {
          title: 'Editor Default Edit',
          version,
        });
        expect(editorUpdate.status).to.equal(200);
      });

      it('Viewer cannot edit documents by default (no explicit permission set)', async () => {
        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        const viewerUpdate = await updateDoc(viewerToken, rootDocId, {
          title: 'Viewer Default Edit Attempt',
          version,
        });
        expect(viewerUpdate.status).to.equal(403);
      });

      it('Creator can edit documents by default', async () => {
        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        const creatorUpdate = await updateDoc(creatorToken, rootDocId, {
          title: 'Creator Default Edit',
          version,
        });
        expect(creatorUpdate.status).to.equal(200);
      });
    });

    // ─── Specific Users Visibility ────────────────────────────────────

    describe('Specific Users Visibility', () => {
      it('Only specified users can see the document', async () => {
        // Set visibility to SPECIFIC_USERS, granting only editor
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'user', id: editorId }],
        );

        // Editor should see the document
        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Creator should NOT see the document (not in subjects)
        const creatorList = await listDocs(creatorToken);
        expect(creatorList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );

        // Viewer should NOT see the document
        const viewerList = await listDocs(viewerToken);
        expect(viewerList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );
      });

      it('Multiple specific users can see the document', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.USER,
          undefined,
          200,
          [
            { type: 'user', id: editorId },
            { type: 'user', id: viewerId },
          ],
        );

        // Both editor and viewer should see the document
        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        const viewerList = await listDocs(viewerToken);
        expect(viewerList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Creator should NOT see the document
        const creatorList = await listDocs(creatorToken);
        expect(creatorList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );
      });

      it('SPECIFIC_USERS visibility applies to documentGet', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'user', id: creatorId }],
        );

        // Creator can get the document
        const creatorGet = await getDoc(creatorToken, rootDocId);
        expect(creatorGet.status).to.equal(200);

        // Editor cannot (not in subjects — returns 404 hidden)
        const editorGet = await getDoc(editorToken, rootDocId);
        expect(editorGet.status).to.equal(404);
      });

      it('Child inherits SPECIFIC_USERS visibility from parent', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'user', id: editorId }],
        );

        // Editor should see child (inherits from root)
        const editorChildren = await listDocs(editorToken, rootDocId);
        expect(editorChildren.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === childDocId),
        );

        // Creator should NOT see child
        const creatorChildren = await listDocs(creatorToken, rootDocId);
        expect(creatorChildren.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === childDocId),
        );
      });
    });

    // ─── Specific Users Edit ──────────────────────────────────────────

    describe('Specific Users Edit', () => {
      it('Only specified users can edit the document', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'user', id: creatorId }],
        );

        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        // Creator (in subjects) should be able to edit
        const creatorUpdate = await updateDoc(creatorToken, rootDocId, {
          title: 'Creator Specific Edit',
          version,
        });
        expect(creatorUpdate.status).to.equal(200);

        // Re-fetch version after creator's edit
        const docRes2 = await getDoc(ownerToken, rootDocId);
        const version2 = docRes2.body.version;

        // Editor (not in subjects) should be blocked
        const editorUpdate = await updateDoc(editorToken, rootDocId, {
          title: 'Editor Specific Edit Attempt',
          version: version2,
        });
        expect(editorUpdate.status).to.equal(403);
      });

      it('SPECIFIC_USERS edit blocks delete for non-listed users', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'user', id: creatorId }],
        );

        // Editor (not in subjects) should be blocked from deleting
        const deleteRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentDelete' })
          .set('xc-auth', editorToken)
          .send({ docId: rootDocId });

        expect(deleteRes.status).to.equal(403);
      });
    });

    // ─── Team-Based Permissions ───────────────────────────────────────

    describe('Team-Based Permissions', () => {
      let teamId: string;

      beforeEach(async () => {
        // Create a team and add editor as a member
        const teamRes = await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
          .set('xc-auth', ownerToken)
          .send({
            title: 'Test Team',
            members: [{ user_id: editorId, team_role: 'member' }],
          })
          .expect(200);

        teamId = teamRes.body.id;
      });

      it('Team-based visibility grants access to team members', async () => {
        // Set visibility to SPECIFIC_USERS with the team as subject
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'team', id: teamId }],
        );

        // Editor (team member) should see the document
        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Viewer (not in team) should NOT see the document
        const viewerList = await listDocs(viewerToken);
        expect(viewerList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );
      });

      it('Team-based edit grants edit access to team members', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.USER,
          undefined,
          200,
          [{ type: 'team', id: teamId }],
        );

        const docRes = await getDoc(ownerToken, rootDocId);
        const version = docRes.body.version;

        // Editor (team member) should be able to edit
        const editorUpdate = await updateDoc(editorToken, rootDocId, {
          title: 'Team Member Edit',
          version,
        });
        expect(editorUpdate.status).to.equal(200);

        // Re-fetch version
        const docRes2 = await getDoc(ownerToken, rootDocId);
        const version2 = docRes2.body.version;

        // Viewer (not in team) should be blocked
        const viewerUpdate = await updateDoc(viewerToken, rootDocId, {
          title: 'Non-Team Edit Attempt',
          version: version2,
        });
        expect(viewerUpdate.status).to.equal(403);
      });

      it('Mixed user and team subjects work together', async () => {
        // Grant visibility to the team + viewer individually
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.USER,
          undefined,
          200,
          [
            { type: 'team', id: teamId },
            { type: 'user', id: viewerId },
          ],
        );

        // Editor (team member) should see the document
        const editorList = await listDocs(editorToken);
        expect(editorList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Viewer (individual subject) should see the document
        const viewerList = await listDocs(viewerToken);
        expect(viewerList.body).to.satisfy((docs: any[]) =>
          docs.some((d) => d.id === rootDocId),
        );

        // Creator (not in team or subjects) should NOT see
        const creatorList = await listDocs(creatorToken);
        expect(creatorList.body).to.satisfy(
          (docs: any[]) => !docs.some((d) => d.id === rootDocId),
        );
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

    // ─── Create Under Restricted Parent ─────────────────────────────

    describe('Create Under Restricted Parent', () => {
      it('Editor cannot create child doc under CREATORS_AND_UP edit-restricted parent', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Editor tries to create a child doc under the restricted root
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', editorToken)
          .send({
            title: 'Editor Child Attempt',
            parent_id: rootDocId,
            content: { type: 'doc', content: [{ type: 'paragraph' }] },
          });

        expect(createRes.status).to.equal(403);
      });

      it('Creator can create child doc under CREATORS_AND_UP edit-restricted parent', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', creatorToken)
          .send({
            title: 'Creator Child OK',
            parent_id: rootDocId,
            content: { type: 'doc', content: [{ type: 'paragraph' }] },
          });

        expect(createRes.status).to.equal(200);
      });

      it('Editor can create root-level doc even when another doc is edit-restricted', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_EDIT,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // Creating a root doc (no parent_id) should always work for editors
        const createRes = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', editorToken)
          .send({
            title: 'Editor Root Doc',
            content: { type: 'doc', content: [{ type: 'paragraph' }] },
          });

        expect(createRes.status).to.equal(200);
      });
    });

    // ─── has_permissions flag ─────────────────────────────────────────

    describe('has_permissions flag in list response', () => {
      it('Documents without explicit permissions have has_permissions=false', async () => {
        const res = await listDocs(ownerToken);
        const rootDoc = res.body.find((d: any) => d.id === rootDocId);
        expect(rootDoc.has_permissions).to.equal(false);
      });

      it('Documents with explicit permissions have has_permissions=true', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        const res = await listDocs(ownerToken);
        const rootDoc = res.body.find((d: any) => d.id === rootDocId);
        expect(rootDoc.has_permissions).to.equal(true);
      });

      it('has_permissions resets to false after dropping permission', async () => {
        await setDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.EDITOR,
        );

        await dropDocPermission(
          ownerToken,
          rootDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
        );

        const res = await listDocs(ownerToken);
        const rootDoc = res.body.find((d: any) => d.id === rootDocId);
        expect(rootDoc.has_permissions).to.equal(false);
      });
    });

    // ─── has_children visibility correction ───────────────────────────

    describe('has_children visibility correction', () => {
      it('has_children is false when all children are hidden from user', async () => {
        // rootDoc has childDoc as a child. Hide childDoc from viewer.
        await setDocPermission(
          ownerToken,
          childDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // For viewer, rootDoc should show has_children=false since childDoc is hidden
        const viewerList = await listDocs(viewerToken);
        const rootDoc = viewerList.body.find((d: any) => d.id === rootDocId);
        expect(rootDoc).to.exist;
        expect(rootDoc.has_children).to.equal(false);
      });

      it('has_children is true when at least one child is visible', async () => {
        // Create a second child under root that remains visible
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'documentCreate' })
          .set('xc-auth', ownerToken)
          .send({
            title: 'Visible Child',
            parent_id: rootDocId,
            content: { type: 'doc', content: [{ type: 'paragraph' }] },
          })
          .expect(200);

        // Hide only the first child
        await setDocPermission(
          ownerToken,
          childDocId,
          PermissionKey.DOCUMENT_VISIBILITY,
          PermissionGrantedType.ROLE,
          PermissionRole.CREATOR,
        );

        // For viewer, rootDoc should still show has_children=true
        const viewerList = await listDocs(viewerToken);
        const rootDoc = viewerList.body.find((d: any) => d.id === rootDocId);
        expect(rootDoc).to.exist;
        expect(rootDoc.has_children).to.equal(true);
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
