import 'mocha';
import request from 'supertest';
import { PlanFeatureTypes, WorkspaceUserRoles } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { overrideFeature } from '../../../utils/plan.utils';

// routes
// List : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/invites
// Add : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/invites
// Get : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/invites/{team_id}
// Update : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/invites/{team_id}
// Remove : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/invites/{team_id}

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Workspace Teams v3`, () => {
    let context: any = {};
    let workspaceId: string;
    let featureMock: any;
    let teamId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id;
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: true,
      });

      // Create a team first for testing
      const createData = {
        title: 'Test Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      teamId = createTeam.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    const { expect } = require('chai');

    async function _validateWorkspaceTeam(workspaceTeam) {
      expect(workspaceTeam).to.be.an('object');
      expect(Object.keys(workspaceTeam)).to.include.members([
        'team_id',
        'team_title',
        'workspace_role',
        'created_at',
        'updated_at',
      ]);

      expect(workspaceTeam).to.have.property('team_id').that.is.a('string');
      expect(workspaceTeam).to.have.property('team_title').that.is.a('string');
      expect(workspaceTeam)
        .to.have.property('workspace_role')
        .that.is.a('string');
      expect(workspaceTeam).to.have.property('created_at').that.is.a('string');
      expect(workspaceTeam).to.have.property('updated_at').that.is.a('string');

      // Validate workspace role is one of the allowed values
      expect(workspaceTeam.workspace_role).to.be.oneOf([
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.COMMENTER,
        WorkspaceUserRoles.NO_ACCESS,
      ]);

      // Optional fields
      if (workspaceTeam.team_icon !== undefined) {
        expect(workspaceTeam).to.have.property('team_icon').that.is.a('string');
      }
      if (workspaceTeam.team_badge_color !== undefined) {
        expect(workspaceTeam)
          .to.have.property('team_badge_color')
          .that.is.a('string');
        expect(workspaceTeam.team_badge_color).to.match(/^#[0-9A-Fa-f]{6}$/);
      }

      // Validate date fields are valid ISO strings
      expect(new Date(workspaceTeam.created_at)).to.be.a('date');
      expect(new Date(workspaceTeam.updated_at)).to.be.a('date');
    }

    it('List Workspace Teams v3', async () => {
      // Add team to workspace first
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // List workspace teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.is.not.empty;
      await _validateWorkspaceTeam(teams[0]);
    });

    it('Add Team to Workspace v3 - Creator Role', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.CREATOR,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const workspaceTeam = addTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.CREATOR,
      );
    });

    it('Add Team to Workspace v3 - Editor Role', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const workspaceTeam = addTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.EDITOR,
      );
    });

    it('Add Team to Workspace v3 - Viewer Role', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.VIEWER,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const workspaceTeam = addTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.VIEWER,
      );
    });

    it('Add Team to Workspace v3 - Commenter Role', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.COMMENTER,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const workspaceTeam = addTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.COMMENTER,
      );
    });

    it('Add Team to Workspace v3 - No Access Role', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.NO_ACCESS,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const workspaceTeam = addTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.NO_ACCESS,
      );
    });

    it('Add Team to Workspace v3 - Owner Role Rejected', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.OWNER, // This should be rejected
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(400);

      // Validation
      const error = addTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('msg')
        .that.includes('Invalid request body');
    });

    it('Add Team to Workspace v3 - Invalid Role Rejected', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: 'invalid-role', // This should be rejected
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(400);

      // Validation
      const error = addTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('msg')
        .that.includes('Invalid request body');
    });

    it('Add Team to Workspace v3 - Team Not Found', async () => {
      const addData = {
        team_id: 'non-existent-team',
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(422);

      // Validation
      const error = addTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Add Team to Workspace v3 - Duplicate Assignment', async () => {
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      // Add team first time
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Try to add same team again
      const duplicateAdd = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(400);

      // Validation
      const error = duplicateAdd.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('message')
        .that.includes('already assigned');
    });

    it('Get Workspace Team v3', async () => {
      // Add team to workspace first
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Get workspace team details
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const workspaceTeam = getTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.EDITOR,
      );
    });

    it('Get Workspace Team v3 - Not Found', async () => {
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites/non-existent-team`)
        .set('xc-token', context.xc_token)
        .expect(400);

      // Validation
      const error = getTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('is not assigned');
    });

    it('Update Workspace Team v3 - Role Change', async () => {
      // Add team to workspace first
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Update team role
      const updateData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.VIEWER,
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // Validation
      const workspaceTeam = updateTeam.body;
      await _validateWorkspaceTeam(workspaceTeam);
      expect(workspaceTeam).to.have.property('team_id', teamId);
      expect(workspaceTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.VIEWER,
      );
    });

    it('Update Workspace Team v3 - Owner Role Rejected', async () => {
      // Add team to workspace first
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Try to update to owner role
      const updateData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.OWNER, // This should be rejected
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(400);

      // Validation
      const error = updateTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('msg')
        .that.includes('Invalid request body');
    });

    it('Update Workspace Team v3 - Team Not Found', async () => {
      const updateData = {
        team_id: 'non-existent-team',
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      const updateTeam = await request(context.app)
        .patch(
          `/api/v3/meta/workspaces/${workspaceId}/invites`,
        )
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(422);

      // Validation
      const error = updateTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Update Workspace Team v3 - Not Assigned to Workspace', async () => {
      // Create another team but don't assign it to workspace
      const createData = {
        title: 'Unassigned Team',
        icon: '🔒',
        badge_color: '#000000',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const unassignedTeamId = createTeam.body.id;

      // Try to update unassigned team
      const updateData = {
        team_id: unassignedTeamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(400);

      // Validation
      const error = updateTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('is not assigned');
    });

    it('Remove Team from Workspace v3', async () => {
      // Add team to workspace first
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Remove team from workspace
      const removeData = {
        team_id: teamId,
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(200);

      // Validation
      const response = removeTeam.body;
      expect(response).to.be.an('object');
      expect(response).to.have.property(
        'msg',
        'Team has been removed from workspace successfully',
      );

      // Verify team is removed from workspace
      await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(400);
    });

    it('Remove Team from Workspace v3 - Not Found', async () => {
      const removeData = {
        team_id: 'non-existent-team',
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(400);

      // Validation
      const error = removeTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('is not assigned');
    });

    it('Remove Team from Workspace v3 - Not Assigned to Workspace', async () => {
      // Create another team but don't assign it to workspace
      const createData = {
        title: 'Unassigned Team',
        icon: '🔒',
        badge_color: '#000000',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const unassignedTeamId = createTeam.body.id;

      // Try to remove unassigned team
      const removeData = {
        team_id: unassignedTeamId,
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(400);

      // Validation
      const error = removeTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('is not assigned');
    });

    it('Forbidden due to plan not sufficient', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: false,
      });

      // Try to list workspace teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(403);

      // Validation
      const error = listTeams.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('error', 'ERR_FORBIDDEN');
      expect(error).to.have.property('message').that.includes('not sufficient');
    });

    it('Multiple Teams in Workspace', async () => {
      // Create additional teams
      const createData1 = {
        title: 'Team 1',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createData2 = {
        title: 'Team 2',
        icon: '💻',
        badge_color: '#00FF00',
      };

      const createTeam1 = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData1)
        .expect(200);

      const createTeam2 = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData2)
        .expect(200);

      const teamId1 = createTeam1.body.id;
      const teamId2 = createTeam2.body.id;

      // Add all teams to workspace with different roles
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId,
          workspace_role: WorkspaceUserRoles.CREATOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId1,
          workspace_role: WorkspaceUserRoles.EDITOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId2,
          workspace_role: WorkspaceUserRoles.VIEWER,
        })
        .expect(200);

      // List all workspace teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.has.length(3);

      // Validate each team
      await Promise.all(teams.map(_validateWorkspaceTeam));

      // Check specific roles
      const creatorTeam = teams.find(
        (t) => t.workspace_role === WorkspaceUserRoles.CREATOR,
      );
      const editorTeam = teams.find(
        (t) => t.workspace_role === WorkspaceUserRoles.EDITOR,
      );
      const viewerTeam = teams.find(
        (t) => t.workspace_role === WorkspaceUserRoles.VIEWER,
      );

      expect(creatorTeam).to.exist;
      expect(editorTeam).to.exist;
      expect(viewerTeam).to.exist;
    });

    it('Remove Team from Workspace - Also Removes from All Bases', async () => {
      // Create a base first
      const createBaseData = {
        title: 'Test Base',
        type: 'database',
      };

      const createBase = await request(context.app)
        .post(`/api/v2/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send(createBaseData)
        .expect(201);

      const baseId = createBase.body.id;

      // Add team to workspace first
      const addData = {
        team_id: teamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Add team to base
      const addBaseData = {
        team_id: teamId,
        base_role: 'editor',
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addBaseData)
        .expect(200);

      // Verify team is assigned to both workspace and base
      const workspaceTeams = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const baseTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      expect(workspaceTeams.body.list).to.be.an('array').that.has.length(1);
      expect(baseTeams.body.list).to.be.an('array').that.has.length(1);

      // Remove team from workspace
      const removeData = {
        team_id: teamId,
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(200);

      // Validation
      const response = removeTeam.body;
      expect(response).to.be.an('object');
      expect(response).to.have.property(
        'msg',
        'Team has been removed from workspace successfully',
      );

      // Verify team is removed from workspace
      const workspaceTeamsAfter = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      expect(workspaceTeamsAfter.body.list).to.be.an('array').that.is.empty;

      // Verify team is also removed from base
      const baseTeamsAfter = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      expect(baseTeamsAfter.body.list).to.be.an('array').that.is.empty;

      // Verify team detail endpoint returns error for base
      await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(400);
    });
  });
}
