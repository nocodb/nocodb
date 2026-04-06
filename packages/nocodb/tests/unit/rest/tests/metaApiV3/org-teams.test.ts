import 'mocha';
import request from 'supertest';
import { EnterpriseOrgUserRoles, TeamUserRoles } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

// Org-level Teams API routes (mirror of workspace teams with /orgs/ scope):
// List :           GET    /api/v3/meta/orgs/{orgId}/teams
// Create :         POST   /api/v3/meta/orgs/{orgId}/teams
// Get :            GET    /api/v3/meta/orgs/{orgId}/teams/{teamId}
// Update :         PATCH  /api/v3/meta/orgs/{orgId}/teams/{teamId}
// Delete :         DELETE /api/v3/meta/orgs/{orgId}/teams/{teamId}
// Add Members :    POST   /api/v3/meta/orgs/{orgId}/teams/{teamId}/members
// Remove Members : DELETE /api/v3/meta/orgs/{orgId}/teams/{teamId}/members
// Update Members : PATCH  /api/v3/meta/orgs/{orgId}/teams/{teamId}/members

/**
 * Helper: create an org and add the context user as admin.
 */
async function createOrg(
  context: any,
  title = 'Test Org',
): Promise<string> {
  const orgId = `org_test_${Date.now()}`;
  await Noco.ncMeta.metaInsert2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.ORG,
    { id: orgId, title },
  );
  await Noco.ncMeta.metaInsert2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.ORG_USERS,
    {
      fk_org_id: orgId,
      fk_user_id: context.user.id,
      roles: EnterpriseOrgUserRoles.ADMIN,
    },
  );
  return orgId;
}

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Org Teams v3`, () => {
    let context: any = {};
    let orgId: string;

    const { expect } = require('chai');

    beforeEach(async () => {
      context = await init();
      orgId = await createOrg(context);
    });

    // ── Validators ──────────────────────────────────────────────

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

      // Org-specific fields
      expect(team).to.have.property('scope', 'org');
      expect(team).to.have.property('fk_org_id', orgId);

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
      expect(Object.keys(teamDetail)).to.include.members([
        'title',
        'members',
      ]);

      expect(teamDetail).to.have.property('title').that.is.a('string');
      expect(teamDetail).to.have.property('members').that.is.an('array');

      // Validate members
      if (teamDetail.members.length > 0) {
        const member = teamDetail.members[0];
        expect(member).to.have.property('user_id').that.is.a('string');
        expect(member)
          .to.have.property('user_email')
          .that.is.a('string');
        expect(member).to.have.property('team_role').that.is.a('string');
        expect(member.team_role).to.be.oneOf([
          TeamUserRoles.OWNER,
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
        TeamUserRoles.OWNER,
        TeamUserRoles.MEMBER,
      ]);
    }

    // ── List ────────────────────────────────────────────────────

    it('List Org Teams v3', async () => {
      // Create a team first
      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Test Org Team' })
        .expect(200);

      // List teams
      const listTeams = await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const teams = listTeams.body.list;
      expect(teams).to.be.an('array').that.is.not.empty;
      await _validateTeam(teams[0]);
    });

    // ── Create ──────────────────────────────────────────────────

    it('Create Org Team v3 - Basic', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Design Team' })
        .expect(200);

      const team = createTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('title', 'Design Team');
      expect(team).to.have.property('members_count', 1); // Creator becomes manager
      expect(team)
        .to.have.property('managers')
        .that.is.an('array')
        .with.length(1);
    });

    it('Create Org Team v3 - With Members', async () => {
      const { user } = await createUser(context, {
        email: 'org-team-member@nocodb.com',
      });

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Development Team',
          members: [
            { user_id: user.id, team_role: TeamUserRoles.MEMBER },
          ],
        })
        .expect(200);

      const team = createTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('members_count', 2); // Creator + member
    });

    it('Create Org Team v3 - With Multiple Managers', async () => {
      const { user: m1 } = await createUser(context, {
        email: 'org-mgr1@nocodb.com',
      });
      const { user: m2 } = await createUser(context, {
        email: 'org-mgr2@nocodb.com',
      });

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Team With Multiple Managers',
          members: [
            { user_id: m1.id, team_role: TeamUserRoles.OWNER },
            { user_id: m2.id, team_role: TeamUserRoles.OWNER },
          ],
        })
        .expect(200);

      const team = createTeam.body;
      await _validateTeam(team);
      expect(team).to.have.property('members_count', 3);
      expect(team).to.have.property('managers').with.length(3);
      expect(team.managers).to.include(m1.id);
      expect(team.managers).to.include(m2.id);
      expect(team.managers).to.include(context.user.id);
    });

    it('Create Org Team v3 - Duplicate Name', async () => {
      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Unique Org Team' })
        .expect(200);

      const duplicate = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Unique Org Team' })
        .expect(400);

      expect(duplicate.body)
        .to.have.property('message')
        .that.includes('already exists');
    });

    it('Create Org Team v3 - Name Too Long', async () => {
      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'A'.repeat(51) })
        .expect(400);
    });

    // ── Get ─────────────────────────────────────────────────────

    it('Get Org Team v3', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Detail Team' })
        .expect(200);

      const teamId = createTeam.body.id;

      const getTeam = await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      await _validateTeamDetail(getTeam.body);
      expect(getTeam.body).to.have.property('title', 'Detail Team');
      expect(getTeam.body.members).to.have.length(1);
    });

    it('Get Org Team v3 - Not Found', async () => {
      await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams/non-existent-team`)
        .set('xc-token', context.xc_token)
        .expect(422);
    });

    // ── Update ──────────────────────────────────────────────────

    it('Update Org Team v3 - Name', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Original Name' })
        .expect(200);

      const updateTeam = await request(context.app)
        .patch(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}`,
        )
        .set('xc-token', context.xc_token)
        .send({ title: 'Updated Name' })
        .expect(200);

      expect(updateTeam.body).to.have.property('title', 'Updated Name');
    });

    it('Update Org Team v3 - Not Found', async () => {
      await request(context.app)
        .patch(`/api/v3/meta/orgs/${orgId}/teams/non-existent-team`)
        .set('xc-token', context.xc_token)
        .send({ title: 'X' })
        .expect(422);
    });

    // ── Delete ──────────────────────────────────────────────────

    it('Delete Org Team v3', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Team To Delete' })
        .expect(200);

      const teamId = createTeam.body.id;

      const deleteTeam = await request(context.app)
        .delete(`/api/v3/meta/orgs/${orgId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);

      expect(deleteTeam.body).to.have.property(
        'msg',
        'Team has been deleted successfully',
      );

      // Verify deleted
      await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(422);
    });

    it('Delete Org Team v3 - Not Found', async () => {
      await request(context.app)
        .delete(`/api/v3/meta/orgs/${orgId}/teams/non-existent-team`)
        .set('xc-token', context.xc_token)
        .expect(422);
    });

    // ── Sub-teams / Hierarchy ───────────────────────────────────

    it('Create Org Sub-Team', async () => {
      const parent = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Org Parent' })
        .expect(200);

      const child = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Org Child',
          parent_team_id: parent.body.id,
        })
        .expect(200);

      await _validateTeam(child.body);
      expect(child.body.fk_parent_team_id).to.equal(parent.body.id);
      expect(child.body.depth).to.equal(1);
      expect(child.body.path).to.include(parent.body.id);
    });

    it('Delete Org Team with children - blocked without force', async () => {
      const parent = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Parent' })
        .expect(200);

      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Child', parent_team_id: parent.body.id })
        .expect(200);

      // Without force — should fail
      const fail = await request(context.app)
        .delete(`/api/v3/meta/orgs/${orgId}/teams/${parent.body.id}`)
        .set('xc-token', context.xc_token)
        .expect(400);

      expect(fail.body.message).to.include('sub-team');
    });

    it('Delete Org Team with children - force reparents', async () => {
      const parent = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Parent To Force' })
        .expect(200);

      const child = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Child To Keep',
          parent_team_id: parent.body.id,
        })
        .expect(200);

      // With force — should succeed
      await request(context.app)
        .delete(
          `/api/v3/meta/orgs/${orgId}/teams/${parent.body.id}?force=true`,
        )
        .set('xc-token', context.xc_token)
        .expect(200);

      // Child reparented to root
      const list = await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .expect(200);

      const reparentedChild = list.body.list.find(
        (t) => t.id === child.body.id,
      );
      expect(reparentedChild).to.exist;
      expect(reparentedChild.fk_parent_team_id).to.be.null;
    });

    // ── Members ─────────────────────────────────────────────────

    it('Add Members to Org Team v3 - Single Member', async () => {
      const { user } = await createUser(context, {
        email: 'org-new-member@nocodb.com',
      });

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Members Team' })
        .expect(200);

      const addMember = await request(context.app)
        .post(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([{ user_id: user.id, team_role: TeamUserRoles.MEMBER }])
        .expect(200);

      expect(addMember.body).to.be.an('array').that.is.not.empty;
      await _validateTeamMember(addMember.body[0]);
      expect(addMember.body[0]).to.have.property('user_id', user.id);
      expect(addMember.body[0]).to.have.property(
        'team_role',
        TeamUserRoles.MEMBER,
      );
    });

    it('Add Members to Org Team v3 - Multiple Members', async () => {
      const { user: u1 } = await createUser(context, {
        email: 'org-m1@nocodb.com',
      });
      const { user: u2 } = await createUser(context, {
        email: 'org-m2@nocodb.com',
      });

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Multi Members' })
        .expect(200);

      const addMembers = await request(context.app)
        .post(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([
          { user_id: u1.id, team_role: TeamUserRoles.MEMBER },
          { user_id: u2.id, team_role: TeamUserRoles.OWNER },
        ])
        .expect(200);

      expect(addMembers.body).to.have.length(2);
      await Promise.all(addMembers.body.map(_validateTeamMember));
    });

    it('Add Members to Org Team v3 - User Not Found', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'User Not Found Test' })
        .expect(200);

      await request(context.app)
        .post(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([
          { user_id: 'non-existent-user', team_role: TeamUserRoles.MEMBER },
        ])
        .expect(422);
    });

    it('Remove Members from Org Team v3', async () => {
      const { user } = await createUser(context, {
        email: 'org-remove-member@nocodb.com',
      });

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Removal Test',
          members: [
            { user_id: user.id, team_role: TeamUserRoles.MEMBER },
          ],
        })
        .expect(200);

      const removeMember = await request(context.app)
        .delete(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([{ user_id: user.id }])
        .expect(200);

      expect(removeMember.body).to.have.property(
        'msg',
        'Members have been removed successfully',
      );
    });

    it('Remove Last Manager from Org Team v3 - Prevented', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Last Manager Test' })
        .expect(200);

      const getTeam = await request(context.app)
        .get(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}`,
        )
        .set('xc-token', context.xc_token)
        .expect(200);

      const creatorId = getTeam.body.members[0].user_id;

      await request(context.app)
        .delete(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([{ user_id: creatorId }])
        .expect(400);
    });

    it('Update Team Members v3 - Role Change', async () => {
      const { user } = await createUser(context, {
        email: 'org-promote@nocodb.com',
      });

      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'Promotion Test',
          members: [
            { user_id: user.id, team_role: TeamUserRoles.MEMBER },
          ],
        })
        .expect(200);

      const updateMember = await request(context.app)
        .patch(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([{ user_id: user.id, team_role: TeamUserRoles.OWNER }])
        .expect(200);

      expect(updateMember.body).to.be.an('array').that.is.not.empty;
      expect(updateMember.body[0]).to.have.property('user_id', user.id);
      expect(updateMember.body[0]).to.have.property(
        'team_role',
        TeamUserRoles.OWNER,
      );
    });

    it('Update Team Members v3 - Member Not Found', async () => {
      const createTeam = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Not Found Member Test' })
        .expect(200);

      await request(context.app)
        .patch(
          `/api/v3/meta/orgs/${orgId}/teams/${createTeam.body.id}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([
          {
            user_id: 'non-existent-user',
            team_role: TeamUserRoles.OWNER,
          },
        ])
        .expect(400);
    });

    // ── Cross-scope: org teams visible in workspace ─────────────

    it('Org teams appear in workspace teamList', async () => {
      // Create an org team
      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send({ title: 'Visible In Workspace' })
        .expect(200);

      // Link workspace to this org
      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .where('id', context.fk_workspace_id)
        .update({ fk_org_id: orgId });

      // Fetch teams for the workspace — should include org teams
      const res = await request(context.app)
        .get(
          `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`,
        )
        .set('xc-token', context.xc_token)
        .expect(200);

      const orgTeams = res.body.list.filter(
        (t) => t.scope === 'org',
      );
      expect(orgTeams).to.have.length.greaterThan(0);
      expect(orgTeams[0]).to.have.property('fk_org_id', orgId);
    });
  });
}
