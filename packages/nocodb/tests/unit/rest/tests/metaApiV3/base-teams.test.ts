import 'mocha';
import request from 'supertest';
import {
  ncIsNullOrUndefined,
  PlanFeatureTypes,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';
import { createProject } from '../../../factory/base';

// routes
// List : http://localhost:8080/api/v3/meta/bases/{base_id}/invites
// Add : http://localhost:8080/api/v3/meta/bases/{base_id}/invites
// Get : http://localhost:8080/api/v3/meta/bases/{base_id}/invites/{team_id}
// Update : http://localhost:8080/api/v3/meta/bases/{base_id}/invites/{team_id}
// Remove : http://localhost:8080/api/v3/meta/bases/{base_id}/invites/{team_id}

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Base Teams v3`, () => {
    let context: any = {};
    let baseId: string;
    let featureMock: any;
    let teamId: string;

    beforeEach(async () => {
      context = await init();
      const base = await createProject(context);
      baseId = base.id;
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
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      teamId = createTeam.body.id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    const { expect } = require('chai');

    async function _validateBaseTeam(baseTeam) {
      expect(baseTeam).to.be.an('object');
      expect(Object.keys(baseTeam)).to.include.members([
        'team_id',
        'team_title',
        'created_at',
        'updated_at',
      ]);

      expect(baseTeam).to.have.property('team_id').that.is.a('string');
      expect(baseTeam).to.have.property('team_title').that.is.a('string');
      expect(baseTeam).to.have.property('created_at').that.is.a('string');
      expect(baseTeam).to.have.property('updated_at').that.is.a('string');

      // Either base_role or workspace_role should be present
      expect(baseTeam).to.satisfy(
        (team) =>
          !ncIsNullOrUndefined(team.base_role) ||
          !ncIsNullOrUndefined(team.workspace_role),
        'Team should have either base_role or workspace_role',
      );

      // Validate base role if present
      if (baseTeam.base_role !== undefined && baseTeam.base_role !== null) {
        expect(baseTeam.base_role).to.be.oneOf([
          ProjectRoles.CREATOR,
          ProjectRoles.EDITOR,
          ProjectRoles.VIEWER,
          ProjectRoles.COMMENTER,
          ProjectRoles.NO_ACCESS,
        ]);
      }

      // Validate workspace role if present
      if (
        baseTeam.workspace_role !== undefined &&
        baseTeam.workspace_role !== null
      ) {
        expect(baseTeam.workspace_role).to.be.oneOf([
          WorkspaceUserRoles.CREATOR,
          WorkspaceUserRoles.EDITOR,
          WorkspaceUserRoles.VIEWER,
          WorkspaceUserRoles.COMMENTER,
          WorkspaceUserRoles.NO_ACCESS,
        ]);
      }

      // Optional fields
      if (baseTeam.team_icon !== undefined) {
        expect(baseTeam).to.have.property('team_icon').that.is.a('string');
      }
      if (baseTeam.team_badge_color !== undefined) {
        expect(baseTeam)
          .to.have.property('team_badge_color')
          .that.is.a('string');
        expect(baseTeam.team_badge_color).to.match(/^#[0-9A-Fa-f]{6}$/);
      }

      // Validate date fields are valid ISO strings
      expect(new Date(baseTeam.created_at)).to.be.a('date');
      expect(new Date(baseTeam.updated_at)).to.be.a('date');
    }

    it('List Base Teams v3', async () => {
      // Add team to base first
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // List base teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.is.not.empty;
      await _validateBaseTeam(teams[0]);
    });

    it('Add Team to Base v3 - Creator Role', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.CREATOR,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const baseTeam = addTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.CREATOR);
    });

    it('Add Team to Base v3 - Editor Role', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const baseTeam = addTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.EDITOR);
    });

    it('Add Team to Base v3 - Viewer Role', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.VIEWER,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const baseTeam = addTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.VIEWER);
    });

    it('Add Team to Base v3 - Commenter Role', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.COMMENTER,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const baseTeam = addTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.COMMENTER);
    });

    it('Add Team to Base v3 - No Access Role', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.NO_ACCESS,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Validation
      const baseTeam = addTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.NO_ACCESS);
    });

    it('Add Team to Base v3 - Owner Role Rejected', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.OWNER, // This should be rejected
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
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

    it('Add Team to Base v3 - Invalid Role Rejected', async () => {
      const addData = {
        team_id: teamId,
        base_role: 'invalid-role', // This should be rejected
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
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

    it('Add Team to Base v3 - Team Not Found', async () => {
      const addData = {
        team_id: 'non-existent-team',
        base_role: ProjectRoles.EDITOR,
      };

      const addTeam = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(422);

      // Validation
      const error = addTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Add Team to Base v3 - Duplicate Assignment', async () => {
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      // Add team first time
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Try to add same team again
      const duplicateAdd = await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
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

    it('Get Base Team v3', async () => {
      // Add team to base first
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Get base team details
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const baseTeam = getTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.EDITOR);
    });

    it('Get Base Team v3 - Is not assigned', async () => {
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites/non-existent-team`)
        .set('xc-token', context.xc_token)
        .expect(400);

      // Validation
      const error = getTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('message')
        .that.includes('is not assigned');
    });

    it('Update Base Team v3 - Role Change', async () => {
      // Add team to base first
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Update team role
      const updateData = {
        team_id: teamId,
        base_role: ProjectRoles.VIEWER,
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // Validation
      const baseTeam = updateTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', teamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.VIEWER);
    });

    it('Update Base Team v3 - Owner Role Rejected', async () => {
      // Add team to base first
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Try to update to owner role
      const updateData = {
        team_id: teamId,
        base_role: ProjectRoles.OWNER, // This should be rejected
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/invites`)
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

    it('Update Base Team v3 - Team Not Found', async () => {
      const updateData = {
        team_id: 'non-existent-team',
        base_role: ProjectRoles.EDITOR,
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(422);

      // Validation
      const error = updateTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Update Base Team v3 - Not Assigned to Base', async () => {
      // Create another team but don't assign it to base
      const createData = {
        title: 'Unassigned Team',
        icon: '🔒',
        badge_color: '#000000',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const unassignedTeamId = createTeam.body.id;

      // Try to update unassigned team
      const updateData = {
        team_id: unassignedTeamId,
        base_role: ProjectRoles.EDITOR,
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(400);

      // Validation
      const error = updateTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('message')
        .that.includes('not assigned to');
    });

    it('Update Base Team v3 - Workspace Inherited Team', async () => {
      // Create a team and assign it to workspace only
      const createData = {
        title: 'Workspace Team',
        icon: '🏢',
        badge_color: '#00FF00',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const workspaceTeamId = createTeam.body.id;

      // Add team to workspace
      const workspaceAddData = {
        team_id: workspaceTeamId,
        workspace_role: WorkspaceUserRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send(workspaceAddData)
        .expect(200);

      // Now try to update the team's base role (should work with our fix)
      const updateData = {
        team_id: workspaceTeamId,
        base_role: ProjectRoles.VIEWER,
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // Validation
      const baseTeam = updateTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', workspaceTeamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.VIEWER);
    });

    it('Remove Team from Base v3', async () => {
      // Add team to base first
      const addData = {
        team_id: teamId,
        base_role: ProjectRoles.EDITOR,
      };

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(addData)
        .expect(200);

      // Remove team from base
      const removeData = {
        team_id: teamId,
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(200);

      // Validation
      const response = removeTeam.body;
      expect(response).to.be.an('object');
      expect(response).to.have.property(
        'msg',
        'Team has been removed from base successfully',
      );

      // Verify team is removed from base
      await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(400);
    });

    it('Remove Team from Base v3 - Not Found', async () => {
      const removeData = {
        team_id: 'non-existent-team',
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(400);

      // Validation
      const error = removeTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('message')
        .that.includes('is not assigned');
    });

    it('Remove Team from Base v3 - Not Assigned to Base', async () => {
      // Create another team but don't assign it to base
      const createData = {
        title: 'Unassigned Team',
        icon: '🔒',
        badge_color: '#000000',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const unassignedTeamId = createTeam.body.id;

      // Try to remove unassigned team
      const removeData = {
        team_id: unassignedTeamId,
      };

      const removeTeam = await request(context.app)
        .delete(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send(removeData)
        .expect(400);

      // Validation
      const error = removeTeam.body;
      expect(error).to.be.an('object');
      expect(error)
        .to.have.property('message')
        .that.includes('is not assigned');
    });

    it('Forbidden due to plan not sufficient', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: false,
      });

      // Try to list base teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(403);

      // Validation
      const error = listTeams.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('error', 'ERR_FORBIDDEN');
      expect(error).to.have.property('message').that.includes('not sufficient');
    });

    it('Multiple Teams in Base', async () => {
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
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData1)
        .expect(200);

      const createTeam2 = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData2)
        .expect(200);

      const teamId1 = createTeam1.body.id;
      const teamId2 = createTeam2.body.id;

      // Add all teams to base with different roles
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId,
          base_role: ProjectRoles.CREATOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId1,
          base_role: ProjectRoles.EDITOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId2,
          base_role: ProjectRoles.VIEWER,
        })
        .expect(200);

      // List all base teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.has.length(3);

      // Validate each team
      await Promise.all(teams.map(_validateBaseTeam));

      // Check specific roles
      const creatorTeam = teams.find(
        (t) => t.base_role === ProjectRoles.CREATOR,
      );
      const editorTeam = teams.find((t) => t.base_role === ProjectRoles.EDITOR);
      const viewerTeam = teams.find((t) => t.base_role === ProjectRoles.VIEWER);

      expect(creatorTeam).to.exist;
      expect(editorTeam).to.exist;
      expect(viewerTeam).to.exist;
    });

    it('List Base Teams v3 - Include Workspace Teams', async () => {
      // Create additional teams for workspace assignment
      const workspaceTeamData1 = {
        title: 'Workspace Team 1',
        icon: '🏢',
        badge_color: '#FF0000',
      };

      const workspaceTeamData2 = {
        title: 'Workspace Team 2',
        icon: '🏭',
        badge_color: '#00FF00',
      };

      const createWorkspaceTeam1 = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(workspaceTeamData1)
        .expect(200);

      const createWorkspaceTeam2 = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(workspaceTeamData2)
        .expect(200);

      const workspaceTeamId1 = createWorkspaceTeam1.body.id;
      const workspaceTeamId2 = createWorkspaceTeam2.body.id;

      // Add teams to workspace with different roles
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: workspaceTeamId1,
          workspace_role: WorkspaceUserRoles.EDITOR,
        })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: workspaceTeamId2,
          workspace_role: WorkspaceUserRoles.VIEWER,
        })
        .expect(200);

      // Add original team to base
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: teamId,
          base_role: ProjectRoles.CREATOR,
        })
        .expect(200);

      // List base teams - should include both base teams and workspace teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.has.length(3);

      // Validate each team
      await Promise.all(teams.map(_validateBaseTeam));

      // Check specific roles
      const baseTeam = teams.find((t) => t.team_id === teamId);
      const workspaceTeam1 = teams.find((t) => t.team_id === workspaceTeamId1);
      const workspaceTeam2 = teams.find((t) => t.team_id === workspaceTeamId2);

      expect(baseTeam).to.exist;
      expect(baseTeam.base_role).to.equal(ProjectRoles.CREATOR);
      expect(baseTeam.workspace_role).to.be.null;

      expect(workspaceTeam1).to.exist;
      expect(workspaceTeam1.base_role).to.be.null;
      expect(workspaceTeam1.workspace_role).to.equal(WorkspaceUserRoles.EDITOR);

      expect(workspaceTeam2).to.exist;
      expect(workspaceTeam2.base_role).to.be.null;
      expect(workspaceTeam2.workspace_role).to.equal(WorkspaceUserRoles.VIEWER);
    });

    it('Get Base Team v3 - Workspace Team', async () => {
      // Create a workspace team
      const workspaceTeamData = {
        title: 'Workspace Team Detail',
        icon: '🔍',
        badge_color: '#0000FF',
      };

      const createWorkspaceTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(workspaceTeamData)
        .expect(200);

      const workspaceTeamId = createWorkspaceTeam.body.id;

      // Add team to workspace
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: workspaceTeamId,
          workspace_role: WorkspaceUserRoles.COMMENTER,
        })
        .expect(200);

      // Get workspace team details through base team endpoint
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites/${workspaceTeamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const baseTeam = getTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', workspaceTeamId);
      expect(baseTeam).to.have.property('base_role', null);
      expect(baseTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.COMMENTER,
      );
    });

    it('Get Base Team v3 - Shows Both Base and Workspace Roles', async () => {
      // Create a team
      const teamData = {
        title: 'Precedence Team',
        icon: '⚖️',
        badge_color: '#FFFF00',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(teamData)
        .expect(200);

      const precedenceTeamId = createTeam.body.id;

      // Add team to workspace first
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: precedenceTeamId,
          workspace_role: WorkspaceUserRoles.VIEWER,
        })
        .expect(200);

      // Add same team to base
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: precedenceTeamId,
          base_role: ProjectRoles.EDITOR,
        })
        .expect(200);

      // Get team details - should show both base role and workspace role
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites/${precedenceTeamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const baseTeam = getTeam.body;
      await _validateBaseTeam(baseTeam);
      expect(baseTeam).to.have.property('team_id', precedenceTeamId);
      expect(baseTeam).to.have.property('base_role', ProjectRoles.EDITOR);
      expect(baseTeam).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.VIEWER,
      );
    });

    it('List Base Teams v3 - Mixed Base and Workspace Teams', async () => {
      // Create teams for different scenarios
      const baseOnlyTeamData = {
        title: 'Base Only Team',
        icon: '📁',
        badge_color: '#FF00FF',
      };

      const workspaceOnlyTeamData = {
        title: 'Workspace Only Team',
        icon: '🏢',
        badge_color: '#00FFFF',
      };

      const bothTeamData = {
        title: 'Both Teams',
        icon: '🔄',
        badge_color: '#FFFFFF',
      };

      const createBaseOnlyTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(baseOnlyTeamData)
        .expect(200);

      const createWorkspaceOnlyTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(workspaceOnlyTeamData)
        .expect(200);

      const createBothTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(bothTeamData)
        .expect(200);

      const baseOnlyTeamId = createBaseOnlyTeam.body.id;
      const workspaceOnlyTeamId = createWorkspaceOnlyTeam.body.id;
      const bothTeamId = createBothTeam.body.id;

      // Add base only team to base
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: baseOnlyTeamId,
          base_role: ProjectRoles.VIEWER,
        })
        .expect(200);

      // Add workspace only team to workspace
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: workspaceOnlyTeamId,
          workspace_role: WorkspaceUserRoles.CREATOR,
        })
        .expect(200);

      // Add both team to workspace
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: bothTeamId,
          workspace_role: WorkspaceUserRoles.COMMENTER,
        })
        .expect(200);

      // Add both team to base
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: bothTeamId,
          base_role: ProjectRoles.EDITOR,
        })
        .expect(200);

      // List all teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.has.length(3);

      // Validate each team
      await Promise.all(teams.map(_validateBaseTeam));

      // Check specific scenarios
      const baseOnlyTeam = teams.find((t) => t.team_id === baseOnlyTeamId);
      const workspaceOnlyTeam = teams.find(
        (t) => t.team_id === workspaceOnlyTeamId,
      );
      const bothTeam = teams.find((t) => t.team_id === bothTeamId);

      expect(baseOnlyTeam).to.exist;
      expect(baseOnlyTeam.base_role).to.equal(ProjectRoles.VIEWER);
      expect(baseOnlyTeam.workspace_role).to.be.null;

      expect(workspaceOnlyTeam).to.exist;
      expect(workspaceOnlyTeam.base_role).to.be.null;
      expect(workspaceOnlyTeam.workspace_role).to.equal(
        WorkspaceUserRoles.CREATOR,
      );

      expect(bothTeam).to.exist;
      expect(bothTeam.base_role).to.equal(ProjectRoles.EDITOR);
      expect(bothTeam.workspace_role).to.equal(WorkspaceUserRoles.COMMENTER); // Both roles shown
    });

    it('List Base Teams v3 - Shows Both Roles When Assigned to Both', async () => {
      // Create a team
      const teamData = {
        title: 'Both Roles Team',
        icon: '🔄',
        badge_color: '#FFA500',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`)
        .set('xc-token', context.xc_token)
        .send(teamData)
        .expect(200);

      const bothRolesTeamId = createTeam.body.id;

      // Add team to workspace first
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${context.fk_workspace_id}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: bothRolesTeamId,
          workspace_role: WorkspaceUserRoles.CREATOR,
        })
        .expect(200);

      // Add same team to base
      await request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({
          team_id: bothRolesTeamId,
          base_role: ProjectRoles.VIEWER,
        })
        .expect(200);

      // List base teams - should show both roles
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.has.length(1);

      const team = teams[0];
      await _validateBaseTeam(team);
      expect(team).to.have.property('team_id', bothRolesTeamId);
      expect(team).to.have.property('base_role', ProjectRoles.VIEWER);
      expect(team).to.have.property(
        'workspace_role',
        WorkspaceUserRoles.CREATOR,
      );
    });
  });
}
