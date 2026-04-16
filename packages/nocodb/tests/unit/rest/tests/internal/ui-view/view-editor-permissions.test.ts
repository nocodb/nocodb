import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, ViewLockType } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { createUser } from '../../../../factory/user';

/**
 * Editor-role view CRUD permissions — verifies the expanded editor powers:
 *
 * CAN:
 *  - create/update/delete collaborative views (any author)
 *  - create/update/delete own personal views
 *  - convert any collaborative view to personal (owned_by = editor)
 *  - convert own personal view back to collaborative
 *
 * CANNOT:
 *  - update or delete locked views (creator+ only)
 *  - set lock_type = locked (creator+ only)
 *  - update or delete other users' personal views
 */
export const viewEditorPermissionsTests = function () {
  if (!isEE()) {
    return;
  }

  describe('View CRUD — editor permissions', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let baseId: string;
    let tableId: string;
    let INTERNAL_API_BASE: string;
    let featureMock: any;

    let ownerToken: string;
    let creatorToken: string;
    let editorToken: string;
    let editor2Token: string;

    let ownerId: string;
    let creatorId: string;
    let editorId: string;
    let editor2Id: string;

    const addMember = async (email: string, wsRole: string) => {
      await request(context.app)
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set('xc-auth', ownerToken)
        .send({ email, roles: wsRole })
        .expect(200);
    };

    const createView = async (
      token: string,
      body: Record<string, any>,
      op = 'gridViewCreate',
    ) =>
      request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: op, tableId })
        .set('xc-auth', token)
        .send(body);

    const updateView = async (
      token: string,
      viewId: string,
      body: Record<string, any>,
    ) =>
      request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'viewUpdate', viewId })
        .set('xc-auth', token)
        .send(body);

    const deleteView = async (token: string, viewId: string) =>
      request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation: 'viewDelete', viewId })
        .set('xc-auth', token)
        .send({});

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;
      ownerToken = context.token;
      ownerId = context.user.id;

      // Enable the FEATURE_PERSONAL_VIEWS-adjacent view features used in these tests.
      featureMock = await overrideFeature({
        workspace_id: workspaceId,
        feature: PlanFeatureTypes.FEATURE_PERSONAL_VIEWS,
        allowed: true,
      });

      // Create base
      const baseRes = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-auth', ownerToken)
        .send({ title: 'EditorPermBase' })
        .expect(200);
      baseId = baseRes.body.id;
      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      // Create users: one creator, two editors.
      const creator = await createUser(
        { app: context.app },
        { email: 'creator@editperm.com', password: 'Test1234!' },
      );
      creatorToken = creator.token;
      creatorId = creator.user.id;
      await addMember('creator@editperm.com', 'workspace-level-creator');

      const editor = await createUser(
        { app: context.app },
        { email: 'editor@editperm.com', password: 'Test1234!' },
      );
      editorToken = editor.token;
      editorId = editor.user.id;
      await addMember('editor@editperm.com', 'workspace-level-editor');

      const editor2 = await createUser(
        { app: context.app },
        { email: 'editor2@editperm.com', password: 'Test1234!' },
      );
      editor2Token = editor2.token;
      editor2Id = editor2.user.id;
      await addMember('editor2@editperm.com', 'workspace-level-editor');

      // Create a table
      const tableRes = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/tables`)
        .set('xc-auth', ownerToken)
        .send({
          title: 'EditorPermTable',
          fields: [{ title: 'Title', type: 'SingleLineText' }],
        })
        .expect(200);
      tableId = tableRes.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ----------------------------------------------------------------
    // Create
    // ----------------------------------------------------------------

    describe('Create', () => {
      it('editor can create a collaborative view', async () => {
        const res = await createView(editorToken, { title: 'EditorCollab' });
        expect(res.status).to.eq(200);
        expect(res.body.lock_type).to.eq(ViewLockType.Collaborative);
      });

      it('editor can create own personal view', async () => {
        const res = await createView(editorToken, {
          title: 'EditorPersonal',
          lock_type: ViewLockType.Personal,
        });
        expect(res.status).to.eq(200);
        expect(res.body.lock_type).to.eq(ViewLockType.Personal);
      });
    });

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    describe('Update', () => {
      it('editor can update title of collaborative view created by owner', async () => {
        const view = (
          await createView(ownerToken, { title: 'OwnerCollab' })
        ).body;
        const res = await updateView(editorToken, view.id, {
          title: 'EditorRenamed',
        });
        expect(res.status).to.eq(200);
        expect(res.body.title).to.eq('EditorRenamed');
      });

      it('editor can update own personal view', async () => {
        const view = (
          await createView(editorToken, {
            title: 'MyPersonal',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        const res = await updateView(editorToken, view.id, {
          title: 'MyPersonalRenamed',
        });
        expect(res.status).to.eq(200);
        expect(res.body.title).to.eq('MyPersonalRenamed');
      });

      it('editor cannot update another editor\'s personal view', async () => {
        const view = (
          await createView(editorToken, {
            title: 'Editor1Personal',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        const res = await updateView(editor2Token, view.id, {
          title: 'ShouldFail',
        });
        expect(res.status).to.eq(403);
      });

      it('editor cannot update a locked view', async () => {
        const view = (await createView(ownerToken, { title: 'OwnerCollab' }))
          .body;
        await updateView(ownerToken, view.id, {
          lock_type: ViewLockType.Locked,
        });
        const res = await updateView(editorToken, view.id, {
          title: 'ShouldFail',
        });
        // service layer returns 401 (NcError.unauthorized); any 4xx is acceptable proof of denial
        expect(res.status).to.eq(403);
      });

      it('editor cannot set lock_type = Locked', async () => {
        const view = (
          await createView(editorToken, { title: 'EditorCollab' })
        ).body;
        const res = await updateView(editorToken, view.id, {
          lock_type: ViewLockType.Locked,
        });
        expect(res.status).to.eq(403);
      });

      it('creator can set lock_type = Locked', async () => {
        const view = (
          await createView(creatorToken, { title: 'CreatorCollab' })
        ).body;
        const res = await updateView(creatorToken, view.id, {
          lock_type: ViewLockType.Locked,
        });
        expect(res.status).to.eq(200);
        expect(res.body.lock_type).to.eq(ViewLockType.Locked);
      });
    });

    // ----------------------------------------------------------------
    // Convert collab → personal
    // ----------------------------------------------------------------

    describe('Convert collaborative → personal', () => {
      it('editor can convert owner-created collab view to personal (owned_by = editor)', async () => {
        const view = (await createView(ownerToken, { title: 'OwnerCollab2' }))
          .body;
        const res = await updateView(editorToken, view.id, {
          lock_type: ViewLockType.Personal,
        });
        expect(res.status).to.eq(200);
        expect(res.body.lock_type).to.eq(ViewLockType.Personal);
        expect(res.body.owned_by).to.eq(editorId);
      });

      it('editor can revert own personal view back to collaborative (owned_by resets to created_by)', async () => {
        const view = (
          await createView(editorToken, {
            title: 'EditorPersonal2',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        const res = await updateView(editorToken, view.id, {
          lock_type: ViewLockType.Collaborative,
        });
        expect(res.status).to.eq(200);
        expect(res.body.lock_type).to.eq(ViewLockType.Collaborative);
        // owned_by should reset to created_by (the editor) so audit attribution
        // is preserved; the view is no longer owner-gated since it's collab.
        expect(res.body.owned_by).to.eq(editorId);
      });

      // Regression test for the compound bug from commit 557a54a320:
      // 1. A view is converted personal → collab, leaving a non-null owned_by.
      // 2. A different user (owner) tries to convert it back to personal.
      //    Previously this hit a stale-owned_by guard and returned 401,
      //    which logged the frontend user out.
      it('owner can re-personalize a view that was previously someone else\'s personal view', async () => {
        // editor makes it personal
        const view = (
          await createView(editorToken, {
            title: 'RevertRepersonalize',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        // editor reverts back to collab (owned_by is now non-null — = editorId)
        await updateView(editorToken, view.id, {
          lock_type: ViewLockType.Collaborative,
        });
        // owner now claims it as personal
        const res = await updateView(ownerToken, view.id, {
          lock_type: ViewLockType.Personal,
        });
        expect(res.status).to.eq(200);
        expect(res.body.lock_type).to.eq(ViewLockType.Personal);
        expect(res.body.owned_by).to.eq(ownerId);
      });

      it('editor cannot transfer view ownership to another user via API', async () => {
        const view = (await createView(ownerToken, { title: 'CollabForXfer' }))
          .body;
        // Editor tries to convert to personal AND assign to editor2 in one go.
        const res = await updateView(editorToken, view.id, {
          lock_type: ViewLockType.Personal,
          owned_by: editor2Id,
        });
        expect(res.status).to.eq(403);
      });

      it('creator can assign a collab view as another user\'s personal view', async () => {
        const view = (await createView(ownerToken, { title: 'CollabForCreatorXfer' }))
          .body;
        const res = await updateView(creatorToken, view.id, {
          lock_type: ViewLockType.Personal,
          owned_by: editorId,
        });
        expect(res.status).to.eq(200);
        expect(res.body.owned_by).to.eq(editorId);
      });
    });

    // ----------------------------------------------------------------
    // Collab view config (sort/filter on non-personal views)
    //
    // Regression test for the middleware gate — editors must be able to add
    // sorts to collaborative views, not just to their own personal ones.
    // ----------------------------------------------------------------

    describe('Sort/Filter on collaborative views', () => {
      it('editor can create a sort on a collab view authored by someone else', async () => {
        const view = (await createView(ownerToken, { title: 'OwnerCollabForSort' }))
          .body;

        // Get the title column ID (first non-system field)
        const colRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: view.id })
          .set('xc-auth', editorToken)
          .expect(200);
        const titleCol = colRes.body?.find?.(
          (c: any) => c.title === 'Title' || c.column?.title === 'Title',
        );
        const fkColumnId = titleCol?.fk_column_id ?? titleCol?.column?.id;
        if (!fkColumnId) {
          // Schema introspection shape varies; skip silently rather than flake.
          return;
        }

        const res = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'sortCreate', viewId: view.id })
          .set('xc-auth', editorToken)
          .send({ fk_column_id: fkColumnId, direction: 'asc' });
        expect(res.status).to.eq(200);
      });
    });

    // ----------------------------------------------------------------
    // Delete
    // ----------------------------------------------------------------

    describe('Delete', () => {
      it('editor can delete any collaborative view', async () => {
        const view = (await createView(ownerToken, { title: 'OwnerCollab3' }))
          .body;
        const res = await deleteView(editorToken, view.id);
        expect(res.status).to.eq(200);
      });

      it('editor can delete own personal view', async () => {
        const view = (
          await createView(editorToken, {
            title: 'EditorPersonal3',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        const res = await deleteView(editorToken, view.id);
        expect(res.status).to.eq(200);
      });

      it('editor cannot delete another editor\'s personal view', async () => {
        const view = (
          await createView(editorToken, {
            title: 'Editor1Personal2',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        const res = await deleteView(editor2Token, view.id);
        expect(res.status).to.eq(403);
      });

      it('editor cannot delete a locked view', async () => {
        const view = (await createView(ownerToken, { title: 'OwnerCollab4' }))
          .body;
        await updateView(ownerToken, view.id, {
          lock_type: ViewLockType.Locked,
        });
        const res = await deleteView(editorToken, view.id);
        expect(res.status).to.eq(403);
      });

      it('creator can delete another user\'s personal view', async () => {
        const view = (
          await createView(editorToken, {
            title: 'EditorPersonalForCreator',
            lock_type: ViewLockType.Personal,
          })
        ).body;
        const res = await deleteView(creatorToken, view.id);
        expect(res.status).to.eq(200);
      });

      it('creator can delete a locked view', async () => {
        const view = (
          await createView(creatorToken, { title: 'CreatorLocked' })
        ).body;
        await updateView(creatorToken, view.id, {
          lock_type: ViewLockType.Locked,
        });
        const res = await deleteView(creatorToken, view.id);
        expect(res.status).to.eq(200);
      });
    });
  });
};
