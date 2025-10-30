import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PlanFeatureTypes,
  ProjectRoles,
  UITypes,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';
import { createProject } from '../../../factory/base';
import { createUser } from '../../../factory/user';

/**
 * Test suite for Team-based Table and Field Permissions
 * 
 * This suite covers:
 * 1. Team permissions on table level (TABLE_RECORD_ADD, TABLE_RECORD_DELETE)
 * 2. Team permissions on field level (RECORD_FIELD_EDIT)
 * 3. Multiple teams with different permission levels
 * 4. Team membership verification
 * 5. Permission enforcement
 */
export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Team Table and Field Permissions`, () => {
    let context: any = {};
    let baseId: string;
    let tableId: string;
    let columnId: string;
    let featureMock: any;
    let teamId: string;
    let anotherTeamId: string;
    let teamMemberUser: any;
    let teamMemberToken: string;
    let anotherTeamMemberUser: any;
    let anotherTeamMemberToken: string;
    let nonTeamUser: any;
    let nonTeamToken: string;

    beforeEach(async () => {
      context = await init();
      const base = await createProject(context);
      baseId = base.id;

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: true,
      });

      // Create users
      const teamMemberUserResult = await createUser(context, {
        email: 'teammember@example.com',
      });
      teamMemberUser = teamMemberUserResult.user;
      teamMemberToken = teamMemberUserResult.token;

      const anotherTeamMemberUserResult = await createUser(context, {
        email: 'anotherteammember@example.com',
      });
      anotherTeamMemberUser = anotherTeamMemberUserResult.user;
      anotherTeamMemberToken = anotherTeamMemberUserResult.token;

      const nonTeamUserResult = await createUser(context, {
        email: 'nonteam@example.com',
      });
      nonTeamUser = nonTeamUserResult.user;
      nonTeamToken = nonTeamUserResult.token;

      // Create teams
      const createTeam1Response = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Team A',
          icon: '🎯',
          badge_color: '#FF5733',
        })
        .expect(200);

      teamId = createTeam1Response.body.id;

      const createTeam2Response = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Team B',
          icon: '🚀',
          badge_color: '#33FF57',
        })
        .expect(200);

      anotherTeamId = createTeam2Response.body.id;

      // Add members to teams
      await request(context.app)
        .post(
          `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams/${teamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([
          {
            user_id: teamMemberUser.id,
            team_role: 'member',
          },
        ])
        .expect(200);

      await request(context.app)
        .post(
          `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams/${anotherTeamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([
          {
            user_id: anotherTeamMemberUser.id,
            team_role: 'member',
          },
        ])
        .expect(200);

      // Assign teams to base
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId,
          base_role: ProjectRoles.EDITOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: anotherTeamId,
          base_role: ProjectRoles.EDITOR,
        })
        .expect(200);

      // Create a table for testing
      const createTableResponse = await request(context.app)
        .post(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          table_name: 'test_table',
          title: 'Test Table',
          columns: [
            {
              title: 'Title',
              uidt: UITypes.SingleLineText,
            },
            {
              title: 'Description',
              uidt: UITypes.LongText,
            },
          ],
        })
        .expect(200);

      tableId = createTableResponse.body.id;
      columnId = createTableResponse.body.columns.find(
        (c: any) => c.title === 'Description',
      ).id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('Team Table Permissions', () => {
      it('Team should be able to add records when granted TABLE_RECORD_ADD permission', async () => {
        // Set permission for team to add records
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Team member should be able to add a record
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Title: 'Test Record by Team Member',
            Description: 'This is a test record',
          })
          .expect(201);
      });

      it('Team should NOT be able to add records without TABLE_RECORD_ADD permission', async () => {
        // Don't set any permission for team

        // Team member should NOT be able to add a record
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Title: 'Unauthorized Record',
            Description: 'This should fail',
          })
          .expect(403);
      });

      it('Non-team user should NOT be able to add records with team permission', async () => {
        // Set permission for team only
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Non-team user should NOT be able to add a record
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', nonTeamToken)
          .send({
            Title: 'Unauthorized Record',
            Description: 'This should fail',
          })
          .expect(403);
      });

      it('Multiple teams should have independent permissions', async () => {
        // Set permission for team A to add records
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Team A member should be able to add records
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Title: 'Record by Team A',
            Description: 'From Team A',
          })
          .expect(201);

        // Team B member should NOT be able to add records
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', anotherTeamMemberToken)
          .send({
            Title: 'Record by Team B',
            Description: 'This should fail',
          })
          .expect(403);
      });

      it('Team should be able to delete records when granted TABLE_RECORD_DELETE permission', async () => {
        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'To be deleted',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Set permission for team to delete records
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_DELETE,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Team member should be able to delete the record
        await request(context.app)
          .delete(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .expect(200);
      });

      it('Team should NOT be able to delete records without TABLE_RECORD_DELETE permission', async () => {
        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'To be kept',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Don't set permission for team

        // Team member should NOT be able to delete the record
        await request(context.app)
          .delete(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .expect(403);
      });
    });

    describe('Team Field Permissions', () => {
      it('Team should be able to edit field when granted RECORD_FIELD_EDIT permission', async () => {
        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'Original description',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Set permission for team to edit the Description field
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.FIELD,
            entity_id: columnId,
            permission: PermissionKey.RECORD_FIELD_EDIT,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Team member should be able to edit the field
        await request(context.app)
          .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Description: 'Updated by team member',
          })
          .expect(200);
      });

      it('Team should NOT be able to edit field without RECORD_FIELD_EDIT permission', async () => {
        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'Original description',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Don't set permission for team

        // Team member should NOT be able to edit the field
        await request(context.app)
          .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Description: 'Trying to update without permission',
          })
          .expect(403);
      });

      it('Non-team user should NOT be able to edit field with team permission', async () => {
        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'Original description',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Set permission for team only
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.FIELD,
            entity_id: columnId,
            permission: PermissionKey.RECORD_FIELD_EDIT,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Non-team user should NOT be able to edit the field
        await request(context.app)
          .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', nonTeamToken)
          .send({
            Description: 'Unauthorized update',
          })
          .expect(403);
      });

      it('Multiple teams should have independent field permissions', async () => {
        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'Original description',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Set permission for team A to edit field
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.FIELD,
            entity_id: columnId,
            permission: PermissionKey.RECORD_FIELD_EDIT,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Team A member should be able to edit the field
        await request(context.app)
          .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Description: 'Updated by Team A',
          })
          .expect(200);

        // Team B member should NOT be able to edit the field
        await request(context.app)
          .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', anotherTeamMemberToken)
          .send({
            Description: 'Trying to update by Team B',
          })
          .expect(403);
      });
    });

    describe('Multiple Permissions on Same Resource', () => {
      it('Team with both TABLE_RECORD_ADD and TABLE_RECORD_DELETE should be able to add and delete', async () => {
        // Set both permissions for team
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_DELETE,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Team member should be able to add a record
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Title: 'Test Record',
            Description: 'To be deleted',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Team member should be able to delete the record
        await request(context.app)
          .delete(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .expect(200);
      });

      it('Team with TABLE_RECORD_ADD but NOT TABLE_RECORD_DELETE should be able to add only', async () => {
        // Set only add permission
        await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: teamId,
              },
            ],
          })
          .expect(200);

        // Create a record first
        const createResponse = await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            Title: 'Test Record',
            Description: 'Existing record',
          })
          .expect(201);

        const recordId = createResponse.body.Id;

        // Team member should be able to add a new record
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            Title: 'New Record',
            Description: 'Added by team member',
          })
          .expect(201);

        // Team member should NOT be able to delete existing record
        await request(context.app)
          .delete(`/api/v1/db/data/noco/${baseId}/${tableId}/${recordId}`)
          .set('xc-token', teamMemberToken)
          .expect(403);
      });
    });

    describe('Permission Validation', () => {
      it('Setting permission for non-existent team should fail', async () => {
        const nonExistentTeamId = 'non-existent-team-id';

        const response = await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: nonExistentTeamId,
              },
            ],
          })
          .expect(422);

        expect(response.body.msg).to.include('not found or is deleted');
      });

      it('Setting permission for team from another workspace should fail', async () => {
        // Create another workspace
        const newContext = await init();
        const newBase = await createProject(newContext);

        // Create a team in the new workspace
        const newTeamResponse = await request(context.app)
          .post(`/api/v3/meta/workspaces/${newContext.fk_workspace_id}/teams`)
          .set('xc-token', newContext.xc_token)
          .send({
            title: 'Other Team',
            icon: '🔒',
            badge_color: '#000000',
          })
          .expect(200);

        const otherTeamId = newTeamResponse.body.id;

        // Try to set permission for team from another workspace
        const response = await request(context.app)
          .post(`/api/v2/meta/permissions`)
          .set('xc-token', context.xc_token)
          .send({
            base_id: baseId,
            entity: PermissionEntity.TABLE,
            entity_id: tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type: PermissionGrantedType.USER,
            granted_role: null,
            subjects: [
              {
                type: 'team',
                id: otherTeamId,
              },
            ],
          })
          .expect(422);

        expect(response.body.msg).to.include(
          'does not belong to this workspace',
        );
      });
    });
  });
}
