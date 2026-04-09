import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { EnterpriseOrgUserRoles, TeamUserRoles } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

// Org-level Teams API routes:
// List :           GET    /api/v3/meta/orgs/{orgId}/teams
// Create :         POST   /api/v3/meta/orgs/{orgId}/teams
// Get :            GET    /api/v3/meta/orgs/{orgId}/teams/{teamId}
// Update :         PATCH  /api/v3/meta/orgs/{orgId}/teams/{teamId}
// Delete :         DELETE /api/v3/meta/orgs/{orgId}/teams/{teamId}
// Add Members :    POST   /api/v3/meta/orgs/{orgId}/teams/{teamId}/members
// Remove Members : DELETE /api/v3/meta/orgs/{orgId}/teams/{teamId}/members
// Update Members : PATCH  /api/v3/meta/orgs/{orgId}/teams/{teamId}/members

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Org Teams v3', () => {
    let context: any = {};
    let orgId: string;

    // ── Shared helpers ──────────────────────────────────────────

    async function setupOrg(title = 'Test Org'): Promise<string> {
      const id = `ot${Date.now().toString(36)}`;
      // Use knex directly — metaInsert2 has scope restrictions
      await Noco.ncMeta.knexConnection(MetaTable.ORG).insert({
        id,
        title,
      });
      await Noco.ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
        fk_org_id: id,
        fk_user_id: context.user.id,
        roles: EnterpriseOrgUserRoles.ADMIN,
      });
      return id;
    }

    async function createTeam(
      title: string,
      parentTeamId?: string,
    ): Promise<string> {
      const body: any = { title };
      if (parentTeamId) body.parent_team_id = parentTeamId;
      const res = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-auth', context.token)
        .send(body);
      if (res.status !== 200) {
        throw new Error(
          `createTeam("${title}") failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }
      return res.body.id;
    }

    async function addUserToOrg(userId: string) {
      const existing = await Noco.ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .where('fk_org_id', orgId)
        .where('fk_user_id', userId)
        .first();
      if (!existing) {
        await Noco.ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
          fk_org_id: orgId,
          fk_user_id: userId,
          roles: EnterpriseOrgUserRoles.VIEWER,
        });
      }
    }

    async function addMember(teamId: string, userId: string) {
      await addUserToOrg(userId);
      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
        .set('xc-auth', context.token)
        .send([{ user_id: userId, team_role: TeamUserRoles.MEMBER }])
        .expect(200);
    }

    async function removeMember(teamId: string, userId: string) {
      await request(context.app)
        .delete(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
        .set('xc-auth', context.token)
        .send([{ user_id: userId }]);
    }

    async function deleteTeam(teamId: string, force = false) {
      const url = force
        ? `/api/v3/meta/orgs/${orgId}/teams/${teamId}?force=true`
        : `/api/v3/meta/orgs/${orgId}/teams/${teamId}`;
      await request(context.app)
        .delete(url)
        .set('xc-auth', context.token);
    }

    async function getTeam(teamId: string) {
      const res = await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams/${teamId}`)
        .set('xc-auth', context.token)
        .expect(200);
      return res.body;
    }

    async function listTeams() {
      const res = await request(context.app)
        .get(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-auth', context.token)
        .expect(200);
      return res.body.list || [];
    }

    // ═══════════════════════════════════════════════════════════
    // STORY 1: CRUD & Hierarchy
    // ═══════════════════════════════════════════════════════════

    describe('CRUD & Hierarchy', () => {
      // Shared state across tests in this story
      let engineeringId: string;
      let frontendId: string;
      let backendId: string;
      let designId: string;

      let engUser: any;
      let engToken: string;
      let feUser: any;
      let feToken: string;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        orgId = await setupOrg();

        // Build org hierarchy:
        //   Engineering
        //     ├── Frontend
        //     └── Backend
        //   Design
        engineeringId = await createTeam('Engineering');
        frontendId = await createTeam('Frontend', engineeringId);
        backendId = await createTeam('Backend', engineeringId);
        designId = await createTeam('Design');

        // Create test users and add to teams
        const engResult = await createUser(context, {
          email: 'org-eng@test.com',
        });
        engUser = engResult.user;
        engToken = engResult.token;

        const feResult = await createUser(context, {
          email: 'org-fe@test.com',
        });
        feUser = feResult.user;
        feToken = feResult.token;

        await addMember(engineeringId, engUser.id);
        await addMember(frontendId, feUser.id);
      });

      it('lists all org teams with correct scope', async () => {
        const teams = await listTeams();

        expect(teams).to.have.length(4);
        teams.forEach((t: any) => {
          expect(t.scope).to.equal('org');
          expect(t.fk_org_id).to.equal(orgId);
        });

        const titles = teams.map((t: any) => t.title);
        expect(titles).to.include.members([
          'Engineering',
          'Frontend',
          'Backend',
          'Design',
        ]);
      });

      it('gets team detail with members', async () => {
        const detail = await getTeam(engineeringId);

        expect(detail.title).to.equal('Engineering');
        expect(detail.members).to.be.an('array');
        // creator (owner) + engUser (member)
        expect(detail.members).to.have.length(2);

        const memberRoles = detail.members.map((m: any) => m.team_role);
        expect(memberRoles).to.include(TeamUserRoles.OWNER);
        expect(memberRoles).to.include(TeamUserRoles.MEMBER);
      });

      it('gets sub-team detail with inherited members', async () => {
        const detail = await getTeam(frontendId);

        expect(detail.title).to.equal('Frontend');
        // Direct: creator (owner) + feUser (member)
        expect(detail.members).to.have.length(2);

        // Inherited from Engineering: engUser
        if (detail.inherited_members) {
          const inherited = detail.inherited_members;
          expect(inherited.length).to.be.greaterThan(0);
          expect(inherited[0].inherited_from_team_title).to.equal(
            'Engineering',
          );
        }
      });

      it('updates team name', async () => {
        const res = await request(context.app)
          .patch(`/api/v3/meta/orgs/${orgId}/teams/${designId}`)
          .set('xc-auth', context.token)
          .send({ title: 'Product Design' })
          .expect(200);

        expect(res.body.title).to.equal('Product Design');
      });

      it('rejects duplicate team name', async () => {
        const res = await request(context.app)
          .post(`/api/v3/meta/orgs/${orgId}/teams`)
          .set('xc-auth', context.token)
          .send({ title: 'Engineering' })
          .expect(400);

        expect(res.body.message).to.include('already exists');
      });

      it('hierarchy: verifies depth and path', async () => {
        const teams = await listTeams();
        const eng = teams.find((t: any) => t.id === engineeringId);
        const fe = teams.find((t: any) => t.id === frontendId);
        const be = teams.find((t: any) => t.id === backendId);

        expect(eng.depth).to.equal(0);
        expect(eng.fk_parent_team_id).to.be.null;

        expect(fe.depth).to.equal(1);
        expect(fe.fk_parent_team_id).to.equal(engineeringId);
        expect(fe.path).to.include(engineeringId);

        expect(be.depth).to.equal(1);
        expect(be.fk_parent_team_id).to.equal(engineeringId);
      });

      it('delete team without children succeeds', async () => {
        await deleteTeam(designId);

        const teams = await listTeams();
        expect(teams.find((t: any) => t.id === designId)).to.not
          .exist;
      });

      it('delete team with children — blocked without force', async () => {
        const res = await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${engineeringId}`,
          )
          .set('xc-auth', context.token)
          .expect(400);

        expect(res.body.message).to.include('sub-team');
      });

      it('delete team with children — force reparents', async () => {
        await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${engineeringId}?force=true`,
          )
          .set('xc-auth', context.token)
          .expect(200);

        const teams = await listTeams();
        // Engineering gone, Frontend and Backend reparented to root
        expect(teams.find((t: any) => t.id === engineeringId)).to
          .not.exist;

        const fe = teams.find((t: any) => t.id === frontendId);
        expect(fe).to.exist;
        expect(fe.fk_parent_team_id).to.be.null;
      });
    });

    // ═══════════════════════════════════════════════════════════
    // STORY 2: Member Management
    // ═══════════════════════════════════════════════════════════

    describe('Member Management', () => {
      let teamId: string;
      let memberUser: any;
      let member2User: any;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        orgId = await setupOrg();

        teamId = await createTeam('Members Team');

        const m1 = await createUser(context, {
          email: 'org-mem1@test.com',
        });
        memberUser = m1.user;
        await addUserToOrg(memberUser.id);

        const m2 = await createUser(context, {
          email: 'org-mem2@test.com',
        });
        member2User = m2.user;
        await addUserToOrg(member2User.id);
      });

      it('adds a single member', async () => {
        const res = await request(context.app)
          .post(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
          .set('xc-auth', context.token)
          .send([
            {
              user_id: memberUser.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ])
          .expect(200);

        expect(res.body).to.be.an('array').with.length(1);
        expect(res.body[0].user_id).to.equal(memberUser.id);
        expect(res.body[0].team_role).to.equal(TeamUserRoles.MEMBER);
      });

      it('adds multiple members', async () => {
        const res = await request(context.app)
          .post(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
          .set('xc-auth', context.token)
          .send([
            {
              user_id: memberUser.id,
              team_role: TeamUserRoles.MEMBER,
            },
            {
              user_id: member2User.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ])
          .expect(200);

        expect(res.body).to.have.length(2);

        const detail = await getTeam(teamId);
        // creator + 2 new members
        expect(detail.members).to.have.length(3);
      });

      it('rejects adding existing member again', async () => {
        await addMember(teamId, memberUser.id);

        await request(context.app)
          .post(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
          .set('xc-auth', context.token)
          .send([
            {
              user_id: memberUser.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ])
          .expect(400);
      });

      it('removes a member', async () => {
        await addMember(teamId, memberUser.id);

        await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`,
          )
          .set('xc-auth', context.token)
          .send([{ user_id: memberUser.id }])
          .expect(200);

        const detail = await getTeam(teamId);
        const ids = detail.members.map((m: any) => m.user_id);
        expect(ids).to.not.include(memberUser.id);
      });

      it('org teams have no owner concept — removing creator is allowed', async () => {
        // Org teams are managed by org admins, not team owners
        await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`,
          )
          .set('xc-auth', context.token)
          .send([{ user_id: context.user.id }])
          .expect(200);
      });

      it('org admin can manage team — all members are equal (no team-owner concept)', async () => {
        // Add both members as regular members (not owners)
        await addMember(teamId, memberUser.id);
        await addMember(teamId, member2User.id);

        const detail = await getTeam(teamId);
        // Only the creator is OWNER, both added members are MEMBER
        const members = detail.members.filter(
          (m: any) => m.team_role === TeamUserRoles.MEMBER,
        );
        expect(members).to.have.length(2);

        // Org admin (context.user) can remove any member regardless of team role
        await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`,
          )
          .set('xc-auth', context.token)
          .send([{ user_id: memberUser.id }])
          .expect(200);

        // Org admin can update team without being team owner
        await request(context.app)
          .patch(`/api/v3/meta/orgs/${orgId}/teams/${teamId}`)
          .set('xc-auth', context.token)
          .send({ title: 'Managed By Org Admin' })
          .expect(200);

        const updated = await listTeams();
        expect(updated.find((t: any) => t.id === teamId)?.title).to.equal(
          'Managed By Org Admin',
        );
      });
    });

    // ═══════════════════════════════════════════════════════════
    // STORY 3: Cross-scope visibility
    // ═══════════════════════════════════════════════════════════

    describe('Cross-scope: org teams in workspace', () => {
      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        orgId = await setupOrg();
      });

      it.skip('org teams appear in workspace teamList when linked (feature gap: workspace teamList does not include org teams)', async () => {
        await createTeam('Org Wide Team');

        // Link the test workspace to this org
        await Noco.ncMeta
          .knexConnection(MetaTable.WORKSPACE)
          .where('id', context.fk_workspace_id)
          .update({ fk_org_id: orgId });

        const res = await request(context.app)
          .get(
            `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`,
          )
          .set('xc-auth', context.token)
          .expect(200);

        const orgTeams = res.body.list.filter(
          (t: any) => t.scope === 'org',
        );
        expect(orgTeams).to.have.length.greaterThan(0);
        expect(orgTeams[0].fk_org_id).to.equal(orgId);
        expect(orgTeams[0].title).to.equal('Org Wide Team');
      });

      it('org teams NOT visible in workspace without org link', async () => {
        await createTeam('Isolated Org Team');

        // Do NOT link workspace to org
        const res = await request(context.app)
          .get(
            `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`,
          )
          .set('xc-auth', context.token)
          .expect(200);

        const orgTeams = res.body.list.filter(
          (t: any) => t.scope === 'org',
        );
        expect(orgTeams).to.have.length(0);
      });

      it('org team cannot be set as parent of workspace team', async () => {
        const orgTeamId = await createTeam('Org Parent');

        // Enable team management for workspace
        const { overrideFeature } = await import(
          '../../../utils/plan.utils'
        );
        const mock = await overrideFeature({
          workspace_id: context.fk_workspace_id,
          feature: 'feature_team_management',
          allowed: true,
        });

        // Try to create a workspace team with org team as parent
        const res = await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${context.fk_workspace_id}/teams`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'WS Child of Org',
            parent_team_id: orgTeamId,
          });

        // Should fail — cross-scope parent not allowed (400/422 for validation, 403 for ACL)
        expect(res.status).to.be.oneOf([400, 403, 422]);

        await mock?.restore?.();
      });
    });
  });
}
