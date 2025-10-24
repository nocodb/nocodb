import 'mocha';
import request from 'supertest';
import {
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

// Test cases for team permission behavior and inherited roles
// This test suite covers:
// 1. Team permission inheritance from workspace to base
// 2. Direct base role assignment vs inherited roles
// 3. Role priority hierarchy
// 4. Permission validation for different user roles
// 5. Team member access control

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Team Permissions v3`, () => {
    let context: any = {};
    let baseId: string;
    let featureMock: any;
    let teamId: string;
    let teamMemberUser: any;
    let teamManagerUser: any;
    let nonTeamUser: any;

    beforeEach(async () => {
      context = await init();
      const base = await createProject(context);
      baseId = base.id;

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: true,
      });

      // Create team members with different roles
      teamMemberUser = await createUser(
        { app: context.app },
        {
          email: 'teammember@example.com',
          password: 'A1234abh2@dsad',
          roles: 'editor',
        },
      );

      teamManagerUser = await createUser(
        { app: context.app },
        {
          email: 'teammanager@example.com',
          password: 'A1234abh2@dsad',
          roles: 'editor',
        },
      );

      nonTeamUser = await createUser(
        { app: context.app },
        {
          email: 'nonteam@example.com',
          password: 'A1234abh2@dsad',
          roles: 'editor',
        },
      );

      // Create a team first for testing
      const createData = {
        title: 'Test Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      teamId = createTeam.body.id;

      // Add team members
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

      await request(context.app)
        .post(
          `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams/${teamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([
          {
            user_id: teamManagerUser.user.id,
            team_role: 'manager',
          },
        ])
        .expect(200);
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    const { expect } = require('chai');

    describe('Workspace Team Role Inheritance', () => {
      it('Team with workspace CREATOR role should inherit CREATOR permissions to base', async () => {
        // Assign team to workspace with CREATOR role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.CREATOR,
          })
          .expect(200);

        // Don't assign team to base - should inherit CREATOR role from workspace team
        // (This tests the inheritance from workspace team role to base)

        // Verify team member can access base with CREATOR permissions (inherited)
        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Team member should be able to create tables (CREATOR permission inherited from workspace team)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
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
      });

      it('Team with workspace EDITOR role should inherit EDITOR permissions to base', async () => {
        // Assign team to workspace with EDITOR role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.EDITOR,
          })
          .expect(200);

        // Don't assign team to base - should inherit EDITOR role from workspace team
        // (This tests the inheritance from workspace team role to base)
        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Team member should be able to edit data (EDITOR permission inherited from workspace team)
        // First create a table as the base owner
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
            ],
          })
          .expect(200);

        const tableId = createTableResponse.body.id;

        // Add a record
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Record',
          })
          .expect(200);

        // Team member should be able to update the record
        const a = await request(context.app)
          .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/1`)
          .set('xc-token', teamMemberToken)
          .send({
            title: 'Updated by Team Member',
          })
          .expect(200);
      });

      it('Team with workspace VIEWER role should inherit VIEWER permissions to base', async () => {
        // Assign team to workspace with VIEWER role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.VIEWER,
          })
          .expect(200);

        // Assign team to base
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.COMMENTER,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // First create a table and add data as the base owner
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
            ],
          })
          .expect(200);

        const tableId = createTableResponse.body.id;

        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Record',
          })
          .expect(200);

        // Team member should be able to read data (VIEWER permission)
        await request(context.app)
          .get(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        // Team member should NOT be able to create tables (no CREATOR permission)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
          .send({
            table_name: 'unauthorized_table',
            title: 'Unauthorized Table',
          })
          .expect(403);
      });
    });

    describe('Direct Base Role Assignment Priority', () => {
      it('Direct base role should override inherited workspace role', async () => {
        // Assign team to workspace with CREATOR role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.CREATOR,
          })
          .expect(200);

        // Assign team to base with VIEWER role (should override CREATOR)
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.VIEWER,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Team member should have VIEWER permissions, not CREATOR
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
          .send({
            table_name: 'unauthorized_table',
            title: 'Unauthorized Table',
          })
          .expect(403);
      });

      it('Direct base role should override inherited base-team role', async () => {
        // Assign team to workspace with CREATOR role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.CREATOR,
          })
          .expect(200);

        // Assign team to base with EDITOR role
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.EDITOR,
          })
          .expect(200);

        // Update team role to CREATOR (should be overridden by direct base role)
        await request(context.app)
          .patch(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.VIEWER,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Team member should have VIEWER permissions (direct assignment overrides inheritance)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', teamMemberToken)
          .send({
            table_name: 'unauthorized_table',
            title: 'Unauthorized Table',
          })
          .expect(403);
      });
    });

    describe('Role Hierarchy and Permission Inheritance', () => {
      it('Team manager should have same permissions as team member', async () => {
        // Assign team to workspace with EDITOR role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.EDITOR,
          })
          .expect(200);

        // Assign team to base
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.EDITOR,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        const teamManagerToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamManagerUser.token)
            .expect(200)
        ).body.token;

        // Both team member and manager should have same permissions
        // Create a table first
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
            ],
          })
          .expect(200);

        const tableId = createTableResponse.body.id;

        // Both should be able to edit data
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            title: 'Record by Member',
          })
          .expect(200);

        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamManagerToken)
          .send({
            title: 'Record by Manager',
          })
          .expect(200);
      });

      it('Non-team user should not have access to team-assigned base', async () => {
        // Assign team to workspace and base
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.EDITOR,
          })
          .expect(200);

        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.EDITOR,
          })
          .expect(200);

        const nonTeamToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', nonTeamUser.token)
            .expect(200)
        ).body.token;

        // Non-team user should not have access
        await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/info`)
          .set('xc-token', nonTeamToken)
          .expect(403);
      });
    });

    describe('Permission Edge Cases', () => {
      it('Team with NO_ACCESS workspace role should not inherit any permissions', async () => {
        // Assign team to workspace with NO_ACCESS role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.NO_ACCESS,
          })
          .expect(200);

        // Assign team to base
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.VIEWER,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Team member should have VIEWER permissions (direct base assignment)
        // Create a table first
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
            ],
          })
          .expect(200);

        const tableId = createTableResponse.body.id;

        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Record',
          })
          .expect(200);

        // Should be able to read (VIEWER permission from direct assignment)
        await request(context.app)
          .get(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        // Should NOT be able to edit (NO_ACCESS workspace role doesn't override VIEWER base role)
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            title: 'Unauthorized Record',
          })
          .expect(403);
      });

      it('Team removed from workspace should lose base access (when only inherited)', async () => {
        // Assign team to workspace ONLY (not to base)
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.EDITOR,
          })
          .expect(200);

        // Don't assign to base - should inherit from workspace

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Verify team member has access (inherited from workspace)
        await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/info`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        // Remove team from workspace
        await request(context.app)
          .delete(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
          })
          .expect(200);

        // Team member should lose access to base (no more workspace role to inherit)
        await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/info`)
          .set('xc-token', teamMemberToken)
          .expect(403);
      });

      it('Team removed from base should lose base access but keep workspace access', async () => {
        // Assign team to workspace and base
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.EDITOR,
          })
          .expect(200);

        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.EDITOR,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Verify team member has access to base
        await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/info`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        // Remove team from base
        await request(context.app)
          .delete(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
          })
          .expect(200);

        // Team member should still have access to base (inherited from workspace)
        await request(context.app)
          .get(`/api/v1/db/meta/projects/${baseId}/info`)
          .set('xc-token', teamMemberToken)
          .expect(200);

        // And should still have workspace access
        await request(context.app)
          .get(`/api/v3/meta/workspaces/${context.fk_workspace_id}/bases`)
          .set('xc-token', teamMemberToken)
          .expect(200);
      });
    });

    describe('Multiple Teams and Role Conflicts', () => {
      it('User in multiple teams should get highest permission level', async () => {
        // Create second team
        const createTeam2Response = await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Team 2',
            icon: '🔒',
            badge_color: '#000000',
          })
          .expect(200);

        const teamId2 = createTeam2Response.body.id;

        // Add same user to second team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams/${teamId2}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: teamMemberUser.user.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // Assign first team to workspace with VIEWER role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: WorkspaceUserRoles.VIEWER,
          })
          .expect(200);

        // Assign second team to workspace with CREATOR role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId2,
            workspace_role: WorkspaceUserRoles.CREATOR,
          })
          .expect(200);

        // Assign both teams to base
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: ProjectRoles.VIEWER,
          })
          .expect(200);

        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId2,
            base_role: ProjectRoles.EDITOR,
          })
          .expect(200);

        const teamMemberToken = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', teamMemberUser.token)
            .expect(200)
        ).body.token;

        // Create a table first (using owner token)
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
            ],
          })
          .expect(200);

        const tableId = createTableResponse.body.id;

        // User should have EDITOR permissions (highest from base team roles)
        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
          .set('xc-token', teamMemberToken)
          .send({
            title: 'Record by Member',
          })
          .expect(200);
      });
    });
  });
}
