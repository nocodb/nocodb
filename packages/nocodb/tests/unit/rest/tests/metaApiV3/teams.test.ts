import 'mocha';
import request from 'supertest';
import { PlanFeatureTypes, TeamUserRoles } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { overrideFeature } from '../../../utils/plan.utils';

// routes
// List : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams
// Create : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams
// Get : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams/{team_id}
// Update : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams/{team_id}
// Delete : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams/{team_id}
// Add Members : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams/{team_id}/members
// Remove Members : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams/{team_id}/members
// Update Members : http://localhost:8080/api/v3/meta/workspaces/{workspace_id}/teams/{team_id}/members

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Teams v3`, () => {
    let context: any = {};
    let workspaceId: string;
    let featureMock: any;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id;
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: true,
      });
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    const { expect } = require('chai');

    async function _validateTeam(team) {
      expect(team).to.be.an('object');
      expect(Object.keys(team)).to.include.members([
        'id',
        'title',
        'members_count',
        'managers',
        'created_at',
        'updated_at',
      ]);

      expect(team).to.have.property('id').that.is.a('string');
      expect(team).to.have.property('title').that.is.a('string');
      expect(team).to.have.property('members_count').that.is.a('number');
      expect(team).to.have.property('managers').that.is.an('array');
      expect(team).to.have.property('created_at').that.is.a('string');
      expect(team).to.have.property('updated_at').that.is.a('string');

      // Optional fields
      if (team.icon !== undefined) {
        expect(team).to.have.property('icon').that.is.a('string');
      }
      if (team.badge_color !== undefined) {
        expect(team).to.have.property('badge_color').that.is.a('string');
        expect(team.badge_color).to.match(/^#[0-9A-Fa-f]{6}$/);
      }

      // Validate managers array contains strings
      team.managers.forEach((managerId) => {
        expect(managerId).to.be.a('string');
      });

      // Validate date fields are valid ISO strings
      expect(new Date(team.created_at)).to.be.a('date');
      expect(new Date(team.updated_at)).to.be.a('date');
    }

    async function _validateTeamDetail(teamDetail) {
      expect(teamDetail).to.be.an('object');
      expect(Object.keys(teamDetail)).to.include.members(['title', 'members']);

      expect(teamDetail).to.have.property('title').that.is.a('string');
      expect(teamDetail).to.have.property('members').that.is.an('array');

      // Optional fields
      if (teamDetail.icon !== undefined) {
        expect(teamDetail).to.have.property('icon').that.is.a('string');
      }
      if (teamDetail.badge_color !== undefined) {
        expect(teamDetail).to.have.property('badge_color').that.is.a('string');
        expect(teamDetail.badge_color).to.match(/^#[0-9A-Fa-f]{6}$/);
      }

      // Validate members
      if (teamDetail.members.length > 0) {
        const member = teamDetail.members[0];
        expect(member).to.have.property('user_id').that.is.a('string');
        expect(member).to.have.property('user_email').that.is.a('string');
        expect(member).to.have.property('team_role').that.is.a('string');
        expect(member.team_role).to.be.oneOf([
          TeamUserRoles.MANAGER,
          TeamUserRoles.MEMBER,
        ]);
      }
    }

    async function _validateTeamMember(member) {
      expect(member).to.be.an('object');
      expect(Object.keys(member)).to.include.members([
        'user_id',
        'user_email',
        'team_role',
      ]);

      expect(member).to.have.property('user_id').that.is.a('string');
      expect(member)
        .to.have.property('user_email')
        .that.is.a('string')
        .and.includes('@');
      expect(member).to.have.property('team_role').that.is.a('string');
      expect(member.team_role).to.be.oneOf([
        TeamUserRoles.MANAGER,
        TeamUserRoles.MEMBER,
      ]);
    }

    it('List Teams v3', async () => {
      // Create a team first
      const createData = {
        title: 'Test Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      // List teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.is.not.empty;
      await _validateTeam(teams[0]);
    });

    it('Create Team v3 - Basic', async () => {
      const createData = {
        title: 'Design Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      // Validation
      const team = createTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('title', 'Design Team');
      expect(team).to.have.property('icon', '🎨');
      expect(team).to.have.property('badge_color', '#FF5733');
      expect(team).to.have.property('members_count', 1); // Creator becomes manager
      expect(team)
        .to.have.property('managers')
        .that.is.an('array')
        .with.length(1);
      expect(team.managers[0]).to.be.a('string'); // Manager user ID
    });

    it('Create Team v3 - With Members', async () => {
      const { user } = await createUser(context, {
        email: 'team-member@nocodb.com',
      });

      const createData = {
        title: 'Development Team',
        icon: '💻',
        badge_color: '#00FF00',
        members: [
          {
            user_id: user.id,
            team_role: TeamUserRoles.MEMBER,
          },
        ],
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      // Validation
      const team = createTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('title', 'Development Team');
      expect(team).to.have.property('members_count', 2); // Creator + member
      expect(team)
        .to.have.property('managers')
        .that.is.an('array')
        .with.length(1);
      expect(team.managers[0]).to.be.a('string'); // Creator becomes manager
    });

    it('Create Team v3 - With Multiple Managers', async () => {
      const { user: manager1 } = await createUser(context, {
        email: 'manager1@nocodb.com',
      });
      const { user: manager2 } = await createUser(context, {
        email: 'manager2@nocodb.com',
      });

      const createData = {
        title: 'Team With Multiple Managers',
        icon: '👥',
        badge_color: '#00FF00',
        members: [
          {
            user_id: manager1.id,
            team_role: TeamUserRoles.MANAGER,
          },
          {
            user_id: manager2.id,
            team_role: TeamUserRoles.MANAGER,
          },
        ],
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      // Validation
      const team = createTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('title', 'Team With Multiple Managers');
      expect(team).to.have.property('members_count', 3); // Creator + 2 managers
      expect(team)
        .to.have.property('managers')
        .that.is.an('array')
        .with.length(3); // Creator + 2 managers
      expect(team.managers).to.include(manager1.id);
      expect(team.managers).to.include(manager2.id);
      expect(team.managers).to.include(context.user.id); // Creator
    });

    it('Create Team v3 - Name Too Long', async () => {
      const createData = {
        title: 'A'.repeat(51), // Exceeds 50 character limit
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(400);

      // Validation
      const error = createTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('msg', 'Invalid request body');
    });

    it('Create Team v3 - Duplicate Name', async () => {
      const createData = {
        title: 'Unique Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      // Create first team
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      // Try to create team with same name
      const duplicateTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(400);

      // Validation
      const error = duplicateTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('already exists');
    });

    it('Create Team v3 - Invalid Badge Color', async () => {
      const createData = {
        title: 'Test Team',
        icon: '🎨',
        badge_color: 'invalid-color', // Invalid hex color
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(400);

      // Validation
      const error = createTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('msg', 'Invalid request body');
    });

    it('Get Team v3', async () => {
      // Create a team first
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

      const teamId = createTeam.body.id;

      // Get team details
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const teamDetail = getTeam.body;
      await _validateTeamDetail(teamDetail);
      expect(teamDetail).to.have.property('title', 'Test Team');
      expect(teamDetail).to.have.property('icon', '🎨');
      expect(teamDetail).to.have.property('badge_color', '#FF5733');
      expect(teamDetail.members).to.have.length(1); // Creator becomes manager
    });

    it('Get Team v3 - Not Found', async () => {
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams/non-existent-team`)
        .set('xc-token', context.xc_token)
        .expect(422);

      // Validation
      const error = getTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Update Team v3 - Name and Icon', async () => {
      // Create a team first
      const createData = {
        title: 'Original Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Update team
      const updateData = {
        title: 'Updated Team',
        icon: '💻',
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(200);

      // Validation
      const team = updateTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('title', 'Updated Team');
      expect(team).to.have.property('icon', '💻');
      expect(team).to.have.property('badge_color', '#FF5733'); // Should remain unchanged
    });

    it('Update Team v3 - Badge Color Only', async () => {
      // Create a team first
      const createData = {
        title: 'Test Team',
        icon: '🎨',
        badge_color: '#FF5733',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData);
      // .expect(200);

      const teamId = createTeam.body.id;

      // Update team badge color only
      const updateData = {
        badge_color: '#00FF00',
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .send(updateData);
      // .expect(200);

      // Validation
      const team = updateTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('title', 'Test Team'); // Should remain unchanged
      expect(team).to.have.property('icon', '🎨'); // Should remain unchanged
      expect(team).to.have.property('badge_color', '#00FF00');
    });

    it('Update Team v3 - Not Found', async () => {
      const updateData = {
        title: 'Updated Team',
      };

      const updateTeam = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/teams/non-existent-team`)
        .set('xc-token', context.xc_token)
        .send(updateData)
        .expect(422);

      // Validation
      const error = updateTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Delete Team v3', async () => {
      // Create a team first
      const createData = {
        title: 'Team To Delete',
        icon: '🗑️',
        badge_color: '#FF0000',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Delete team
      const deleteTeam = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      // Validation
      const response = deleteTeam.body;
      expect(response).to.be.an('object');
      expect(response).to.have.property(
        'msg',
        'Team has been deleted successfully',
      );

      // Verify team is deleted
      await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(422);
    });

    it('Delete Team v3 - Not Found', async () => {
      const deleteTeam = await request(context.app)
        .delete(
          `/api/v3/meta/workspaces/${workspaceId}/teams/non-existent-team`,
        )
        .set('xc-token', context.xc_token)
        .expect(422);

      // Validation
      const error = deleteTeam.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Add Members to Team v3 - Single Member', async () => {
      const { user } = await createUser(context, {
        email: 'new-member@nocodb.com',
      });

      // Create a team first
      const createData = {
        title: 'Team With Members',
        icon: '👥',
        badge_color: '#0000FF',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Add member to team
      const addMemberData = [
        {
          user_id: user.id,
          team_role: TeamUserRoles.MEMBER,
        },
      ];

      const addMember = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send(addMemberData)
        .expect(200);

      // Validation
      const members = addMember.body;
      expect(members).to.be.an('array').that.is.not.empty;
      await _validateTeamMember(members[0]);
      expect(members[0]).to.have.property('user_id', user.id);
      expect(members[0]).to.have.property('team_role', TeamUserRoles.MEMBER);
    });

    it('Add Members to Team v3 - Multiple Members', async () => {
      const { user: user1 } = await createUser(context, {
        email: 'member1@nocodb.com',
      });
      const { user: user2 } = await createUser(context, {
        email: 'member2@nocodb.com',
      });

      // Create a team first
      const createData = {
        title: 'Team With Multiple Members',
        icon: '👥',
        badge_color: '#0000FF',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Add multiple members to team
      const addMembersData = [
        {
          user_id: user1.id,
          team_role: TeamUserRoles.MEMBER,
        },
        {
          user_id: user2.id,
          team_role: TeamUserRoles.MANAGER,
        },
      ];

      const addMembers = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send(addMembersData)
        .expect(200);

      // Validation
      const members = addMembers.body;
      expect(members).to.be.an('array').that.has.length(2);
      await Promise.all(members.map(_validateTeamMember));

      const member1 = members.find((m) => m.user_id === user1.id);
      expect(member1).to.have.property('team_role', TeamUserRoles.MEMBER);

      const member2 = members.find((m) => m.user_id === user2.id);
      expect(member2).to.have.property('team_role', TeamUserRoles.MANAGER);
    });

    it('Add Members to Team v3 - User Not Found', async () => {
      // Create a team first
      const createData = {
        title: 'Team For Testing',
        icon: '🧪',
        badge_color: '#FF00FF',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Try to add non-existent user
      const addMemberData = [
        {
          user_id: 'non-existent-user',
          team_role: TeamUserRoles.MEMBER,
        },
      ];

      const addMember = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send(addMemberData)
        .expect(422);

      // Validation
      const error = addMember.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Remove Members from Team v3 - Single Member', async () => {
      const { user } = await createUser(context, {
        email: 'member-to-remove@nocodb.com',
      });

      // Create a team with a member
      const createData = {
        title: 'Team For Removal',
        icon: '👥',
        badge_color: '#FF0000',
        members: [
          {
            user_id: user.id,
            team_role: TeamUserRoles.MEMBER,
          },
        ],
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Remove member from team
      const removeMemberData = [
        {
          user_id: user.id,
        },
      ];

      const removeMember = await request(context.app)
        .delete(
          `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send(removeMemberData)
        .expect(200);

      // Validation
      const response = removeMember.body;
      expect(response).to.be.an('object');
      expect(response).to.have.property(
        'msg',
        'Members have been removed successfully',
      );
    });

    it('Remove Members from Team v3 - Last Manager Prevention', async () => {
      // Create a team (creator becomes manager)
      const createData = {
        title: 'Team With Only Manager',
        icon: '👑',
        badge_color: '#FFD700',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Get the creator's user ID from the team details
      const getTeam = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const creatorId = getTeam.body.members[0].user_id;

      // Try to remove the last manager
      const removeMemberData = [
        {
          user_id: creatorId,
        },
      ];

      const removeMember = await request(context.app)
        .delete(
          `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send(removeMemberData)
        .expect(400);

      // Validation
      const error = removeMember.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('last manager');
    });

    it('Update Team Members v3 - Role Change', async () => {
      const { user } = await createUser(context, {
        email: 'member-to-promote@nocodb.com',
      });

      // Create a team with a member
      const createData = {
        title: 'Team For Promotion',
        icon: '📈',
        badge_color: '#00FF00',
        members: [
          {
            user_id: user.id,
            team_role: TeamUserRoles.MEMBER,
          },
        ],
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData);
      // .expect(200);

      const teamId = createTeam.body.id;

      // Update member role
      const updateMemberData = [
        {
          user_id: user.id,
          team_role: TeamUserRoles.MANAGER,
        },
      ];

      const updateMember = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send(updateMemberData)
        .expect(200);

      // Validation
      const members = updateMember.body;
      expect(members).to.be.an('array').that.is.not.empty;
      await _validateTeamMember(members[0]);
      expect(members[0]).to.have.property('user_id', user.id);
      expect(members[0]).to.have.property('team_role', TeamUserRoles.MANAGER);
    });

    it('Update Team Members v3 - Member Not Found', async () => {
      // Create a team first
      const createData = {
        title: 'Team For Testing',
        icon: '🧪',
        badge_color: '#FF00FF',
      };

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(createData)
        .expect(200);

      const teamId = createTeam.body.id;

      // Try to update non-existent member
      const updateMemberData = [
        {
          user_id: 'non-existent-user',
          team_role: TeamUserRoles.MANAGER,
        },
      ];

      const updateMember = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send(updateMemberData)
        .expect(400);

      // Validation
      const error = updateMember.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('message').that.includes('not found');
    });

    it('Forbidden due to plan not sufficient', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT}`,
        allowed: false,
      });

      // Try to list teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .expect(403);

      // Validation
      const error = listTeams.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('error', 'ERR_FORBIDDEN');
      expect(error).to.have.property('message').that.includes('not sufficient');
    });
  });
}
