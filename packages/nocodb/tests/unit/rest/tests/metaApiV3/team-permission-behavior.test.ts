import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { PlanFeatureTypes, ProjectRoles } from 'nocodb-sdk';
import { WorkspaceRoles } from 'nocodb-sdk-v2';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { createProject } from '../../../factory/base';
import { overrideFeature } from '../../../utils/plan.utils';

// Test team role permission behavior and inheritance
export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Team Permission Behavior v3`, () => {
    let context: any = {};
    let workspaceId: string;
    let baseId: string;
    let featureMock: any;
    let teamId: string;
    let testUser: any;
    let testUserToken: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id;

      // Create a base for testing
      const base = await createProject(context);
      baseId = base.id;

      featureMock = await overrideFeature({
        workspace_id: workspaceId,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: true,
      });

      // Create a test user
      const userResult = await createUser(context, {
        email: 'testuser@example.com',
      });
      testUser = userResult.user;
      testUserToken = userResult.token;

      // Create a team
      const teamResponse = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Test Team',
          icon: '🎯',
          badge_color: '#FF5733',
        })
        .expect(200);

      teamId = teamResponse.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('Role Inheritance Hierarchy', () => {
      it('Direct base role should override team roles', async () => {
        // 1. Add user to team with editor role
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team to base with creator role
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: 'creator',
          })
          .expect(200);

        // 3. Verify user inherits creator role from team (no direct base assignment)
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .query({ base_id: baseId })
          .set('xc-auth', testUserToken)
          .expect(200);

        // User should have creator role inherited from team
        expect(userWithRoles.body.base_roles).to.have.property('creator', true);
      });

      it('Base team role should override workspace team role', async () => {
        // 1. Add user to team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team to workspace with editor role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: 'editor',
          })
          .expect(200);

        // 3. Assign team to base with creator role (should override workspace team role)
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: 'creator',
          })
          .expect(200);

        // 4. Verify user has creator role in base (base team role overrides workspace team role)
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.have.property('creator', true);
        expect(userWithRoles.body.base_roles).to.not.have.property('editor');
      });

      it('Workspace team role should be inherited when no base team role', async () => {
        // 1. Add user to team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team to workspace with editor role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: 'editor',
          })
          .expect(200);

        // 3. Don't assign team to base - user should inherit workspace team role
        // 4. Verify user inherits editor role in base from workspace team
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.have.property('editor', true);
      });

      it('Direct workspace role should override workspace team role', async () => {
        // 1. Add user to team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team to workspace with editor role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: 'editor',
          })
          .expect(200);

        // 3. Assign user directly to workspace with viewer role (should override team role)
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send({
            user_id: testUser.id,
            workspace_role: 'viewer',
          })
          .expect(200);

        // 4. Verify user has viewer role in workspace (direct role overrides team role)
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.workspace_roles).to.have.property(
          'viewer',
          true,
        );
        expect(userWithRoles.body.workspace_roles).to.not.have.property(
          'editor',
        );
      });
    });

    describe('Permission Behavior Verification', () => {
      it('User with creator role should be able to create tables', async () => {
        // 1. Assign user directly to base with creator role
        await request(context.app)
          .post(`/api/v2/meta/bases/${baseId}/users`)
          .set('xc-token', context.xc_token)
          .send({
            email: testUser.email,
            base_role: 'creator',
          })
          .expect(200);

        // 2. Create API token for test user
        const tokenResponse = await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', testUserToken)
          .expect(200);

        const userApiToken = tokenResponse.body.token;

        // 3. Verify user can create table (creator permission)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', userApiToken)
          .send({
            title: 'Test Table',
            table_name: 'test_table',
            columns: [
              {
                column_name: 'id',
                title: 'ID',
                uidt: 'id',
              },
            ],
          })
          .expect(200);
      });

      it('User with viewer role should not be able to create tables', async () => {
        // 1. Assign user directly to base with viewer role
        await request(context.app)
          .post(`/api/v2/meta/bases/${baseId}/users`)
          .set('xc-token', context.xc_token)
          .send({
            email: testUser.email,
            base_role: 'viewer',
          })
          .expect(200);

        // 2. Create API token for test user
        const tokenResponse = await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', testUserToken)
          .expect(200);

        const userApiToken = tokenResponse.body.token;

        // 3. Verify user cannot create table (viewer permission)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', userApiToken)
          .send({
            title: 'Test Table',
            table_name: 'test_table',
            columns: [
              {
                column_name: 'id',
                title: 'ID',
                uidt: 'id',
              },
            ],
          })
          .expect(403);
      });

      it('User with editor role should be able to create tables but not manage base', async () => {
        // 1. Assign user directly to base with editor role
        await request(context.app)
          .post(`/api/v2/meta/bases/${baseId}/users`)
          .set('xc-token', context.xc_token)
          .send({
            email: testUser.email,
            base_role: 'editor',
          })
          .expect(200);

        // 2. Create API token for test user
        const tokenResponse = await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', testUserToken)
          .expect(200);

        const userApiToken = tokenResponse.body.token;

        // 3. Verify user can create table (editor permission)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', userApiToken)
          .send({
            title: 'Test Table',
            table_name: 'test_table',
            columns: [
              {
                column_name: 'id',
                title: 'ID',
                uidt: 'id',
              },
            ],
          })
          .expect(200);

        // 4. Verify user cannot delete base (editor permission)
        await request(context.app)
          .delete(`/api/v3/meta/bases/${baseId}`)
          .set('xc-token', userApiToken)
          .expect(403);
      });

      it('User with team creator role should have creator permissions', async () => {
        // 1. Add user to team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team to base with creator role
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: 'creator',
          })
          .expect(200);

        // 3. Create API token for test user
        const tokenResponse = await request(context.app)
          .post('/api/v1/tokens/')
          .set('xc-auth', testUserToken)
          .expect(200);

        const userApiToken = tokenResponse.body.token;

        // 4. Verify user can create table (creator permission from team)
        await request(context.app)
          .post(`/api/v1/db/meta/projects/${baseId}/tables`)
          .set('xc-token', userApiToken)
          .send({
            title: 'Test Table',
            table_name: 'test_table',
            columns: [
              {
                column_name: 'id',
                title: 'ID',
                uidt: 'id',
              },
            ],
          })
          .expect(200);
      });
    });

    describe('Role Priority Edge Cases', () => {
      it('Should handle multiple team assignments correctly', async () => {
        // Create another team
        const team2Response = await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'Test Team 2',
            icon: '🚀',
            badge_color: '#33FF57',
          })
          .expect(200);

        const team2Id = team2Response.body.id;

        // 1. Add user to both teams
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${team2Id}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team1 to base with editor role
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: 'editor',
          })
          .expect(200);

        // 3. Assign team2 to base with creator role (should override team1)
        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: team2Id,
            base_role: 'creator',
          })
          .expect(200);

        // 4. Verify user has creator role (highest priority team role)
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.have.property('creator', true);
        expect(userWithRoles.body.base_roles).to.not.have.property('editor');
      });

      it('Should handle role removal correctly', async () => {
        // 1. Add user to team and assign to base
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        await request(context.app)
          .post(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            base_role: 'creator',
          })
          .expect(200);

        // 2. Verify user has creator role
        let userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.have.property('creator', true);

        // 3. Remove team from base
        await request(context.app)
          .delete(`/api/v3/meta/bases/${baseId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
          })
          .expect(200);

        // 4. Verify user no longer has base role
        userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.be.null;
      });
    });

    describe('Workspace vs Base Role Inheritance', () => {
      it('Should inherit workspace team role to base when no base team role', async () => {
        // 1. Add user to team
        await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: testUser.id,
              team_role: 'member',
            },
          ])
          .expect(200);

        // 2. Assign team to workspace with editor role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
          .set('xc-token', context.xc_token)
          .send({
            team_id: teamId,
            workspace_role: 'editor',
          })
          .expect(200);

        // 3. Verify user inherits editor role in base from workspace team
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.have.property('editor', true);
        expect(userWithRoles.body.workspace_roles).to.have.property(
          'editor',
          true,
        );
      });

      it.only('Should not inherit workspace role when user has direct base role', async () => {
        // 1. Assign user directly to workspace with editor role
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send({
            user_id: testUser.id,
            workspace_role: WorkspaceRoles.WorkspaceLevelEditor,
          })
          .expect(200);

        // 2. Assign user directly to base with viewer role
        await request(context.app)
          .post(`/api/v2/meta/bases/${baseId}/users`)
          .set('xc-token', context.xc_token)
          .send({
            email: testUser.email,
            roles: ProjectRoles.VIEWER,
          })
          .expect(200);

        // 3. Verify user has viewer role in base (not inherited from workspace)
        const userWithRoles = await request(context.app)
          .get(`/api/v1/auth/user/me?base_id=${baseId}`)
          .set('xc-auth', testUserToken)
          .expect(200);

        expect(userWithRoles.body.base_roles).to.have.property(
          ProjectRoles.VIEWER,
          true,
        );
        expect(userWithRoles.body.base_roles).to.not.have.property(
          ProjectRoles.EDITOR,
        );
        expect(userWithRoles.body.workspace_roles).to.have.property(
          WorkspaceRoles.WorkspaceLevelEditor,
          true,
        );
      });
    });
  });
}
