import { expect } from 'chai';
import 'mocha';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  PlanFeatureTypes,
  PlanLimitTypes,
  ProjectRoles,
  UITypes,
} from 'nocodb-sdk';
import request from 'supertest';
import { createProject } from '../../../factory/base';
import { createUser } from '../../../factory/user';
import init from '../../../init';
import { isEE } from '../../../utils/helpers';
import { overridePlan } from '../../../utils/plan.utils';

// Test cases for table visibility permission behavior
// This test suite covers:
// 1. Only base owners can configure table visibility permissions
// 2. Default visibility (Everyone) - no permission set
// 3. Viewers & up - role-based permission
// 4. Specific users - user-based permission
// 5. Nobody - no access permission
// 6. Base owners always have access regardless of permission
// 7. Table visibility affects table listing and access
// 8. Team permissions with table visibility

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Table Visibility Permissions v3`, () => {
    let context: any = {};
    let baseId: string;
    let tableId: string;
    let ownerToken: string;
    let creatorUser: any;
    let creatorToken: string;
    let editorUser: any;
    let editorToken: string;
    let viewerUser: any;
    let viewerToken: string;
    let commenterUser: any;
    let commenterToken: string;
    let nonBaseUser: any;
    let nonBaseToken: string;

    beforeEach(async () => {
      context = await init();
      const base = await createProject(context);
      baseId = base.id;
      ownerToken = context.xc_token;

      // Create a table for testing
      const createTableResponse = await request(context.app)
        .post(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-token', ownerToken)
        .send({
          table_name: 'test_table',
          title: 'Test Table',
          columns: [
            {
              title: 'Title',
              uidt: UITypes.SingleLineText,
            },
          ],
        })
        .expect(200);

      tableId = createTableResponse.body.id;

      // Add some test data
      await request(context.app)
        .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-token', ownerToken)
        .send({
          Title: 'Test Record 1',
        })
        .expect(200);

      // Create users with different roles
      creatorUser = await createUser(
        { app: context.app },
        {
          email: 'creator@example.com',
          password: 'A1234abh2@dsad',
        },
      );

      editorUser = await createUser(
        { app: context.app },
        {
          email: 'editor@example.com',
          password: 'A1234abh2@dsad',
        },
      );

      viewerUser = await createUser(
        { app: context.app },
        {
          email: 'viewer@example.com',
          password: 'A1234abh2@dsad',
        },
      );

      commenterUser = await createUser(
        { app: context.app },
        {
          email: 'commenter@example.com',
          password: 'A1234abh2@dsad',
        },
      );

      nonBaseUser = await createUser(
        { app: context.app },
        {
          email: 'nonbase@example.com',
          password: 'A1234abh2@dsad',
        },
      );

      // Assign users to base with different roles
      await request(context.app)
        .post(`/api/v2/meta/bases/${baseId}/users`)
        .set('xc-token', ownerToken)
        .send({
          email: creatorUser.user.email,
          roles: ProjectRoles.CREATOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v2/meta/bases/${baseId}/users`)
        .set('xc-token', ownerToken)
        .send({
          email: editorUser.user.email,
          roles: ProjectRoles.EDITOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v2/meta/bases/${baseId}/users`)
        .set('xc-token', ownerToken)
        .send({
          email: viewerUser.user.email,
          roles: ProjectRoles.VIEWER,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v2/meta/bases/${baseId}/users`)
        .set('xc-token', ownerToken)
        .send({
          email: commenterUser.user.email,
          roles: ProjectRoles.COMMENTER,
        })
        .expect(200);

      // Create API tokens for each user
      creatorToken = (
        await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', creatorUser.token)
          .expect(200)
      ).body.token;

      editorToken = (
        await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', editorUser.token)
          .expect(200)
      ).body.token;

      viewerToken = (
        await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', viewerUser.token)
          .expect(200)
      ).body.token;

      commenterToken = (
        await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', commenterUser.token)
          .expect(200)
      ).body.token;

      nonBaseToken = (
        await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', nonBaseUser.token)
          .expect(200)
      ).body.token;
    });

    describe('Permission Configuration Access Control', () => {
      it('Only base owner can set table visibility permission', async () => {
        // Owner should be able to set permission
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(200);

        // Creator should NOT be able to set permission
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', creatorToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(403);

        // Editor should NOT be able to set permission
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', editorToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(403);
      });

      it('Only base owner can delete table visibility permission', async () => {
        // First set permission as owner
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(200);

        // Creator should NOT be able to delete permission
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', creatorToken)
          .query({ operation: 'dropPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
          })
          .expect(403);
      });
    });

    describe('Default Visibility (Everyone)', () => {
      it('Table should be visible to all base users by default', async () => {
        // No permission set = Everyone can see

        // Creator should see table
        const creatorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', creatorToken)
          .expect(200);

        expect(creatorTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Editor should see table
        const editorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(editorTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Viewer should see table
        const viewerTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(viewerTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Commenter should see table
        const commenterTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', commenterToken)
          .expect(200);

        expect(commenterTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      it('Table should be accessible to all base users by default', async () => {
        // Creator should access table
        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', creatorToken)
          .expect(200);

        // Editor should access table
        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', editorToken)
          .expect(200);

        // Viewer should access table
        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', viewerToken)
          .expect(200);

        // Commenter should access table
        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', commenterToken)
          .expect(200);
      });
    });

    describe('Viewers & Up Permission', () => {
      beforeEach(async () => {
        // Set table visibility to Viewers & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(200);
      });

      it('Viewer role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', viewerToken)
          .expect(200);
      });

      it('Commenter role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', commenterToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', commenterToken)
          .expect(200);
      });

      it('Editor role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', editorToken)
          .expect(200);
      });

      it('Creator role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', creatorToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', creatorToken)
          .expect(200);
      });

      it('Non-base user should not have access to table', async () => {
        await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', nonBaseToken)
          .expect(403);
      });
    });

    describe('Editors & Up Permission', () => {
      beforeEach(async () => {
        // Set table visibility to Editors & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.EDITOR,
          })
          .expect(200);
      });

      it('Editor role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      it('Creator role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', creatorToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      it('Viewer role should NOT have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', viewerToken)
          .expect(404);
      });

      it('Commenter role should NOT have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', commenterToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', commenterToken)
          .expect(404);
      });
    });

    describe('Creators & Up Permission', () => {
      beforeEach(async () => {
        // Set table visibility to Creators & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.CREATOR,
          })
          .expect(200);
      });

      it('Creator role should have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', creatorToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      it('Editor role should NOT have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', editorToken)
          .expect(404);
      });

      it('Viewer role should NOT have access to table', async () => {
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });
    });

    describe('Specific Users Permission', () => {
      beforeEach(async () => {
        // Set table visibility to specific users (creator and editor)
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.USER,
            subjects: [
              {
                type: 'user',
                id: creatorUser.user.id,
              },
              {
                type: 'user',
                id: editorUser.user.id,
              },
            ],
          })
          .expect(200);
      });

      it('Specified users should have access to table', async () => {
        // Creator should have access
        const creatorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', creatorToken)
          .expect(200);

        expect(creatorTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Editor should have access
        const editorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(editorTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      it('Non-specified users should NOT have access to table', async () => {
        // Viewer should NOT have access
        const viewerTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(viewerTables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', viewerToken)
          .expect(404);

        // Commenter should NOT have access
        const commenterTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', commenterToken)
          .expect(200);

        expect(commenterTables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });
    });

    describe('Nobody Permission', () => {
      beforeEach(async () => {
        // Set table visibility to Nobody
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.NOBODY,
          })
          .expect(200);
      });

      it('No base users should have access except owner', async () => {
        // Creator should NOT have access
        const creatorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', creatorToken)
          .expect(200);

        expect(creatorTables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Editor should NOT have access
        const editorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(editorTables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Viewer should NOT have access
        const viewerTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(viewerTables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });
    });

    describe('Base Owner Access', () => {
      it('Base owner should always have access regardless of permission', async () => {
        // Set permission to Nobody
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.NOBODY,
          })
          .expect(200);

        // Owner should still have access
        const ownerTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', ownerToken)
          .expect(200);

        expect(ownerTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        await request(context.app)
          .get(`/api/v1/db/meta/tables/${tableId}`)
          .set('xc-token', ownerToken)
          .expect(200);
      });

      it('Base owner should have access with specific users permission', async () => {
        // Set permission to specific users (not including owner)
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.USER,
            subjects: [
              {
                type: 'user',
                id: creatorUser.user.id,
              },
            ],
          })
          .expect(200);

        // Owner should still have access
        const ownerTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', ownerToken)
          .expect(200);

        expect(ownerTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });
    });

    describe('Permission Updates', () => {
      it('Should be able to update permission from Viewers & up to Editors & up', async () => {
        // Set to Viewers & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(200);

        // Viewer should have access
        let tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Update to Editors & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.EDITOR,
          })
          .expect(200);

        // Viewer should NOT have access now
        tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Editor should still have access
        tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      it('Should be able to delete permission to restore default (Everyone)', async () => {
        // First, ensure no permission exists by trying to delete it
        try {
          await request(context.app)
            .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
            .set('xc-token', ownerToken)
            .query({ operation: 'dropPermission' })
            .send({
              entity: PermissionEntity.TABLE,
              entity_id: tableId,
              permission: PermissionKey.TABLE_VISIBILITY,
            });
        } catch (e) {
          // Ignore if permission doesn't exist
        }

        // Set to Editors & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.EDITOR,
          })
          .expect(200);

        // Viewer should NOT have access
        let tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Delete permission
        // Note: POST endpoints return 200 by default in NestJS, even for delete operations
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'dropPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
          })
          .expect(200);

        // Viewer should now have access (default to Everyone)
        tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });
    });

    describe('Multiple Tables with Different Permissions', () => {
      let table2Id: string;
      let table3Id: string;

      beforeEach(async () => {
        // Create additional tables
        const table2Response = await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', ownerToken)
          .send({
            table_name: 'test_table_2',
            title: 'Test Table 2',
            columns: [
              {
                title: 'Title',
                uidt: UITypes.SingleLineText,
              },
            ],
          })
          .expect(200);

        table2Id = table2Response.body.id;

        const table3Response = await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', ownerToken)
          .send({
            table_name: 'test_table_3',
            title: 'Test Table 3',
            columns: [
              {
                title: 'Title',
                uidt: UITypes.SingleLineText,
              },
            ],
          })
          .expect(200);

        table3Id = table3Response.body.id;

        // Set different permissions
        // Table 1: Viewers & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.VIEWER,
          })
          .expect(200);

        // Table 2: Editors & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: table2Id,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.EDITOR,
          })
          .expect(200);

        // Table 3: Default (Everyone) - no permission set
      });

      it('User should only see tables they have access to', async () => {
        // Viewer should see table1 (Viewers & up) and table3 (default)
        const viewerTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', viewerToken)
          .expect(200);

        const viewerTableIds = viewerTables.body.list.map((t: any) => t.id);
        expect(viewerTableIds).to.include(tableId);
        expect(viewerTableIds).to.not.include(table2Id);
        expect(viewerTableIds).to.include(table3Id);

        // Editor should see all tables
        const editorTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', editorToken)
          .expect(200);

        const editorTableIds = editorTables.body.list.map((t: any) => t.id);
        expect(editorTableIds).to.include(tableId);
        expect(editorTableIds).to.include(table2Id);
        expect(editorTableIds).to.include(table3Id);
      });
    });

    describe.skip('Team Permissions with Table Visibility', () => {
      // TODO: Re-enable when it's clear on workspace / base team controller
      let teamId: string;
      let teamMemberUser: any;
      let teamMemberToken: string;
      let featureMock: any;

      beforeEach(async () => {
        featureMock = await overridePlan({
          workspace_id: context.fk_workspace_id,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 10 },
        });
        // Create a team
        const createTeam = await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Team',
            icon: '🎯',
            badge_color: '#FF5733',
          })
          .expect(200);

        teamId = createTeam.body.id;

        // Create team member user
        teamMemberUser = await createUser(
          { app: context.app },
          {
            email: 'teammember@example.com',
            password: 'A1234abh2@dsad',
          },
        );

        // Add user to team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: teamMemberUser.user.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // Assign team to base with editor role
        // (The base assignment service will automatically add team to workspace if needed)
        // Use context.xc_token which is the workspace owner and base creator
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.EDITOR,
          })
          .expect(200);

        teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      it('Team member should respect table visibility permissions', async () => {
        // Set table visibility to Creators & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.CREATOR,
          })
          .expect(200);

        // Team member with editor role should NOT see table (permission requires creator)
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        expect(tables.body.list).to.not.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );

        // Update table visibility to Editors & up
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.ROLE,
            granted_role: PermissionRole.EDITOR,
          })
          .expect(200);

        // Team member with editor role should now see table
        const updatedTables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        expect(updatedTables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });

      // skip for now, don't know how to test this
      it.skip('Team member should have access when table visibility is set to specific users including team', async () => {
        // Set table visibility to specific users (team member)
        await request(context.app)
          .post(`/api/v2/internal/${context.fk_workspace_id}/${baseId}`)
          .set('xc-token', ownerToken)
          .query({ operation: 'setPermission' })
          .send({
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_VISIBILITY,
            granted_type: PermissionGrantedType.USER,
            subjects: [
              {
                type: 'user',
                id: teamMemberUser.user.id,
              },
            ],
          })
          .expect(200);

        // Team member should have access
        const tables = await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        expect(tables.body.list).to.satisfy((tables: any[]) =>
          tables.some((t) => t.id === tableId),
        );
      });
    });
  });
}
