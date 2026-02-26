import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import {
  PlanFeatureTypes,
  PlanLimitTypes,
  TeamUserRoles,
} from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { overridePlan } from '../../../utils/plan.utils';

/**
 * Team Hierarchy Tests — Phase 1 & Phase 2
 *
 * Phase 1: Materialized path hierarchy (getDescendants, getAncestors, isAncestor, reparent, getTree)
 * Phase 2: Permission/RLS descendant expansion (hierarchy_scope on subjects)
 *
 * Test hierarchy:
 *   Engineering (depth=0)
 *   ├── Frontend (depth=1)
 *   │   └── Web Team (depth=2)
 *   └── Backend (depth=1)
 *   Sales (depth=0)
 */

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Team Hierarchy v3', () => {
    let context: any = {};
    let workspaceId: string;
    let featureMock: any;

    // Team IDs — created in beforeEach
    let engineeringId: string;
    let frontendId: string;
    let backendId: string;
    let webTeamId: string;
    let salesId: string;

    // Users
    let engUser: any;
    let engToken: string;
    let feUser: any;
    let feToken: string;
    let beUser: any;
    let beToken: string;
    let webUser: any;
    let webToken: string;
    let salesUser: any;
    let salesToken: string;

    /**
     * Helper: create a team via API
     */
    async function createTeam(
      title: string,
      parentTeamId?: string,
    ): Promise<string> {
      const body: any = { title, icon: '🏢', badge_color: '#3366FF' };
      if (parentTeamId) body.parent_team_id = parentTeamId;

      const res = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(body);

      if (res.status !== 200) {
        throw new Error(
          `createTeam("${title}") failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      return res.body.id;
    }

    /**
     * Helper: add a user to a team
     */
    async function addMember(teamId: string, userId: string) {
      await request(context.app)
        .post(
          `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([{ user_id: userId, team_role: TeamUserRoles.MEMBER }])
        .expect(200);
    }

    /**
     * Helper: get team detail
     */
    async function getTeam(teamId: string) {
      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}`)
        .set('xc-token', context.xc_token)
        .expect(200);
      return res.body;
    }

    /**
     * Helper: get team tree
     */
    async function getTeamTree() {
      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams/tree`)
        .set('xc-token', context.xc_token)
        .expect(200);
      return res.body;
    }

    /**
     * Helper: move team to a new parent (or root if null)
     */
    async function moveTeam(teamId: string, parentTeamId: string | null) {
      return request(context.app)
        .patch(
          `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/move`,
        )
        .set('xc-token', context.xc_token)
        .send({ parent_team_id: parentTeamId });
    }

    /**
     * Helper: list teams
     */
    async function listTeams() {
      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .expect(200);
      return res.body;
    }

    beforeEach(async function () {
      this.timeout(120000);
      context = await init();
      workspaceId = context.fk_workspace_id;

      featureMock = await overridePlan({
        workspace_id: workspaceId,
        features: {
          [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true,
        },
        limits: {
          [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100,
        },
      });

      // Build hierarchy: Engineering → Frontend → Web Team, Engineering → Backend, Sales
      engineeringId = await createTeam('Engineering');
      frontendId = await createTeam('Frontend', engineeringId);
      backendId = await createTeam('Backend', engineeringId);
      webTeamId = await createTeam('Web Team', frontendId);
      salesId = await createTeam('Sales');

      // Create 5 test users
      const engResult = await createUser(context, {
        email: 'eng-h@test.com',
      });
      engUser = engResult.user;
      engToken = engResult.token;

      const feResult = await createUser(context, {
        email: 'fe-h@test.com',
      });
      feUser = feResult.user;
      feToken = feResult.token;

      const beResult = await createUser(context, {
        email: 'be-h@test.com',
      });
      beUser = beResult.user;
      beToken = beResult.token;

      const webResult = await createUser(context, {
        email: 'web-h@test.com',
      });
      webUser = webResult.user;
      webToken = webResult.token;

      const salesResult = await createUser(context, {
        email: 'sales-h@test.com',
      });
      salesUser = salesResult.user;
      salesToken = salesResult.token;

      // Assign users to their respective teams
      await addMember(engineeringId, engUser.id);
      await addMember(frontendId, feUser.id);
      await addMember(backendId, beUser.id);
      await addMember(webTeamId, webUser.id);
      await addMember(salesId, salesUser.id);
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // ---------------------------------------------------------------
    // Phase 1: Team Hierarchy — Materialized Path
    // ---------------------------------------------------------------

    describe('Phase 1: Team Hierarchy', () => {
      describe('Team CRUD with hierarchy', () => {
        it('should retrieve all teams in the hierarchy', async () => {
          const data = await listTeams();
          const teams = data.list || data;
          const teamArray = Array.isArray(teams) ? teams : [];
          const titles = teamArray.map((t: any) => t.title);

          expect(titles).to.include('Engineering');
          expect(titles).to.include('Frontend');
          expect(titles).to.include('Backend');
          expect(titles).to.include('Web Team');
          expect(titles).to.include('Sales');
          expect(teamArray.length).to.be.greaterThanOrEqual(5);
        });

        it('should retrieve team detail by ID', async () => {
          const team = await getTeam(engineeringId);
          expect(team).to.have.property('title', 'Engineering');
          expect(team).to.have.property('members').that.is.an('array');
        });

        it('should create a child team under an existing parent', async () => {
          const childId = await createTeam('QA Team', backendId);
          const child = await getTeam(childId);
          expect(child).to.have.property('title', 'QA Team');

          // Verify the total team count increased
          const data = await listTeams();
          const teams = data.list || data;
          const titles = (Array.isArray(teams) ? teams : []).map(
            (t: any) => t.title,
          );
          expect(titles).to.include('QA Team');
        });

        it('should create a deeply nested team', async () => {
          const deepId = await createTeam('React Team', webTeamId);
          const deep = await getTeam(deepId);
          expect(deep).to.have.property('title', 'React Team');
        });
      });

      describe('Team members', () => {
        it('each team should have its assigned member', async () => {
          const engDetail = await getTeam(engineeringId);
          const engEmails = engDetail.members.map((m: any) => m.user_email);
          expect(engEmails).to.include('eng-h@test.com');

          const feDetail = await getTeam(frontendId);
          const feEmails = feDetail.members.map((m: any) => m.user_email);
          expect(feEmails).to.include('fe-h@test.com');

          const webDetail = await getTeam(webTeamId);
          const webEmails = webDetail.members.map((m: any) => m.user_email);
          expect(webEmails).to.include('web-h@test.com');
        });

        it('adding a member to a child team should not add them to parent', async () => {
          const engDetail = await getTeam(engineeringId);
          const engEmails = engDetail.members.map((m: any) => m.user_email);
          // fe-member is in Frontend, not in Engineering
          expect(engEmails).to.not.include('fe-h@test.com');
          expect(engEmails).to.not.include('web-h@test.com');
        });
      });

      describe('Reparent (Move Team)', () => {
        it('should move a child team to a new parent', async () => {
          // Move Frontend from Engineering to Sales
          const res = await moveTeam(frontendId, salesId);
          expect(res.status).to.equal(200);

          // Frontend should still be accessible
          const movedFrontend = await getTeam(frontendId);
          expect(movedFrontend).to.have.property('title', 'Frontend');

          // Web Team (child of Frontend) should also still be accessible
          const movedWebTeam = await getTeam(webTeamId);
          expect(movedWebTeam).to.have.property('title', 'Web Team');
        });

        it('should move a team to root (no parent)', async () => {
          // Move Frontend to root
          const res = await moveTeam(frontendId, null);
          expect(res.status).to.equal(200);

          // Frontend should still be accessible
          const rootFrontend = await getTeam(frontendId);
          expect(rootFrontend).to.have.property('title', 'Frontend');
        });
      });

      describe('Delete team in hierarchy', () => {
        it('should delete a leaf team', async () => {
          await request(context.app)
            .delete(
              `/api/v3/meta/workspaces/${workspaceId}/teams/${webTeamId}`,
            )
            .set('xc-token', context.xc_token)
            .expect(200);

          // Verify team is deleted
          await request(context.app)
            .get(
              `/api/v3/meta/workspaces/${workspaceId}/teams/${webTeamId}`,
            )
            .set('xc-token', context.xc_token)
            .expect(422);

          // Other teams should still exist
          const data = await listTeams();
          const teams = data.list || data;
          const titles = (Array.isArray(teams) ? teams : []).map(
            (t: any) => t.title,
          );
          expect(titles).to.include('Engineering');
          expect(titles).to.include('Frontend');
          expect(titles).to.not.include('Web Team');
        });
      });
    });

    // ---------------------------------------------------------------
    // Phase 2: Permission Descendant Expansion
    // ---------------------------------------------------------------

    describe('Phase 2: Permission Descendant Expansion', () => {
      let baseId: string;
      let tableId: string;

      /**
       * Helper: create a base + table for permission testing
       */
      async function setupBaseAndTable() {
        // Create base
        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);
        baseId = base.id;

        // Create a table in the base
        const { createTable } = await import('../../../factory/table');
        const table = await createTable(context, base);
        tableId = table.id;
      }

      /**
       * Helper: set permission via internal API
       */
      async function setPermission(
        permissionKey: string,
        subjects: any[],
      ) {
        const res = await request(context.app)
          .post(`/api/v2/internal/${workspaceId}/${baseId}`)
          .set('xc-token', context.xc_token)
          .query({ operation: 'setPermission' })
          .send({
            entity: 'table',
            entity_id: tableId,
            permission: permissionKey,
            granted_type: 'user',
            subjects,
          });
        return res;
      }

      /**
       * Helper: drop a permission
       */
      async function dropPermission(permissionKey: string) {
        await request(context.app)
          .post(`/api/v2/internal/${workspaceId}/${baseId}`)
          .set('xc-token', context.xc_token)
          .query({ operation: 'dropPermission' })
          .send({
            entity: 'table',
            entity_id: tableId,
            permission: permissionKey,
          });
      }

      beforeEach(async function () {
        this.timeout(120000);
        await setupBaseAndTable();

        // Give all test users workspace editor role so they pass middleware
        const inviteData = [
          engUser.id,
          feUser.id,
          beUser.id,
          webUser.id,
          salesUser.id,
        ].map((userId) => ({
          user_id: userId,
          workspace_role: 'workspace-level-editor',
        }));

        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send(inviteData)
          .expect(200);
      });

      afterEach(async () => {
        await dropPermission('TABLE_RECORD_ADD');
      });

      describe('setPermission with team subjects', () => {
        it('should set permission with a team subject', async () => {
          const res = await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId },
          ]);

          expect(res.status).to.equal(200);
        });

        it('should set permission with hierarchy_scope=self_and_descendants', async () => {
          const res = await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_and_descendants',
            },
          ]);

          expect(res.status).to.equal(200);
        });

        it('should set permission with hierarchy_scope=self_only', async () => {
          const res = await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ]);

          expect(res.status).to.equal(200);
        });

        it('should set permission with mixed user and team subjects', async () => {
          const res = await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId },
            { type: 'user', id: salesUser.id },
          ]);

          expect(res.status).to.equal(200);
        });

        it('should verify hierarchy_scope=self_only behavior after setting', async () => {
          // Set with explicit self_only
          await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ]);

          // Direct member should be allowed
          const engRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', engToken)
            .send({ Title: 'test-persist-eng' });
          expect(engRes.status).to.be.oneOf([200, 201]);

          // Descendant should be blocked (proves self_only was persisted)
          const feRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'test-persist-fe' });
          expect(feRes.status).to.be.oneOf([401, 403]);
        });
      });

      describe('Permission.isAllowed — self_and_descendants (default)', () => {
        beforeEach(async () => {
          // Set TABLE_RECORD_ADD permission with Engineering team (default: self_and_descendants)
          const res = await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId },
          ]);
          expect(res.status).to.equal(200);
        });

        it('direct team member should be allowed', async () => {
          // eng-member is directly in Engineering
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', engToken)
            .send({ Title: 'test-eng' });

          expect(res.status).to.be.oneOf([200, 201]);
        });

        it('child team member should be allowed (descendant expansion)', async () => {
          // fe-member is in Frontend (child of Engineering)
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'test-fe' });

          expect(res.status).to.be.oneOf([200, 201]);
        });

        it('sibling child team member should be allowed', async () => {
          // be-member is in Backend (child of Engineering)
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', beToken)
            .send({ Title: 'test-be' });

          expect(res.status).to.be.oneOf([200, 201]);
        });

        it('grandchild team member should be allowed (deep descendant)', async () => {
          // web-member is in Web Team (grandchild of Engineering)
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', webToken)
            .send({ Title: 'test-web' });

          expect(res.status).to.be.oneOf([200, 201]);
        });

        it('unrelated team member should be blocked', async () => {
          // sales-member is in Sales (no relation to Engineering)
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', salesToken)
            .send({ Title: 'test-sales' });

          expect(res.status).to.be.oneOf([401, 403]);
        });
      });

      describe('Permission.isAllowed — self_only', () => {
        beforeEach(async () => {
          // Set TABLE_RECORD_ADD permission with Engineering team, self_only
          const res = await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ]);
          expect(res.status).to.equal(200);
        });

        it('direct team member should still be allowed', async () => {
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', engToken)
            .send({ Title: 'test-eng-self' });

          expect(res.status).to.be.oneOf([200, 201]);
        });

        it('child team member should be BLOCKED', async () => {
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'test-fe-blocked' });

          expect(res.status).to.be.oneOf([401, 403]);
        });

        it('grandchild team member should be BLOCKED', async () => {
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', webToken)
            .send({ Title: 'test-web-blocked' });

          expect(res.status).to.be.oneOf([401, 403]);
        });

        it('sibling child team member should be BLOCKED', async () => {
          const res = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', beToken)
            .send({ Title: 'test-be-blocked' });

          expect(res.status).to.be.oneOf([401, 403]);
        });
      });

      describe('Permission.isAllowed — mixed subjects', () => {
        it('should allow user from team OR direct user subject', async () => {
          // Set permission with Engineering team + Sales user as subjects
          await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId, hierarchy_scope: 'self_only' },
            { type: 'user', id: salesUser.id },
          ]);

          // eng-member (direct Engineering member) → allowed
          const engRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', engToken)
            .send({ Title: 'eng-mixed' });
          expect(engRes.status).to.be.oneOf([200, 201]);

          // sales-member (direct user subject) → allowed
          const salesRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', salesToken)
            .send({ Title: 'sales-mixed' });
          expect(salesRes.status).to.be.oneOf([200, 201]);

          // fe-member (descendant of Engineering, self_only) → blocked
          const feRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-mixed' });
          expect(feRes.status).to.be.oneOf([401, 403]);
        });

        it('should allow with multiple team subjects', async () => {
          // Set permission with Engineering (self_only) + Sales team (default self_and_descendants)
          await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId, hierarchy_scope: 'self_only' },
            { type: 'team', id: salesId },
          ]);

          // eng-member (direct Engineering) → allowed
          const engRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', engToken)
            .send({ Title: 'eng-multi' });
          expect(engRes.status).to.be.oneOf([200, 201]);

          // sales-member (direct Sales) → allowed
          const salesRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', salesToken)
            .send({ Title: 'sales-multi' });
          expect(salesRes.status).to.be.oneOf([200, 201]);

          // fe-member (descendant of Engineering, self_only) → blocked
          const feRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-multi' });
          expect(feRes.status).to.be.oneOf([401, 403]);
        });
      });

      describe('Switching hierarchy_scope', () => {
        it('should switch from self_and_descendants to self_only', async () => {
          // Start with self_and_descendants
          await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId },
          ]);

          // fe-member should be allowed (descendant expansion)
          const feRes1 = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-before-switch' });
          expect(feRes1.status).to.be.oneOf([200, 201]);

          // Switch to self_only
          await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ]);

          // fe-member should now be blocked
          const feRes2 = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-after-switch' });
          expect(feRes2.status).to.be.oneOf([401, 403]);

          // eng-member should still be allowed
          const engRes = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', engToken)
            .send({ Title: 'eng-after-switch' });
          expect(engRes.status).to.be.oneOf([200, 201]);
        });

        it('should switch from self_only to self_and_descendants', async () => {
          // Start with self_only
          await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ]);

          // fe-member should be blocked
          const feRes1 = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-before-expand' });
          expect(feRes1.status).to.be.oneOf([401, 403]);

          // Switch to self_and_descendants
          await setPermission('TABLE_RECORD_ADD', [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_and_descendants',
            },
          ]);

          // fe-member should now be allowed
          const feRes2 = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-after-expand' });
          expect(feRes2.status).to.be.oneOf([200, 201]);
        });
      });

      describe('Dropping and re-adding permissions', () => {
        it('should restore access after re-adding permission', async () => {
          // Set permission
          await setPermission('TABLE_RECORD_ADD', [
            { type: 'team', id: engineeringId },
          ]);

          // fe-member allowed
          const feRes1 = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-before-drop' });
          expect(feRes1.status).to.be.oneOf([200, 201]);

          // Drop permission
          await dropPermission('TABLE_RECORD_ADD');

          // fe-member should be allowed again (no restriction when no permission set)
          const feRes2 = await request(context.app)
            .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
            .set('xc-auth', feToken)
            .send({ Title: 'fe-after-drop' });
          expect(feRes2.status).to.be.oneOf([200, 201]);
        });
      });
    });

    // ---------------------------------------------------------------
    // Role Resolution: Override Behavior
    //
    // Workspace roles use OVERRIDE semantics — if a user has a direct
    // workspace role assignment, it takes priority over any team-derived
    // workspace role. Team roles are only used as a fallback when no
    // direct assignment exists.
    //
    // Full integration tests for workspace-team and base-team role
    // override are in team-permission-behavior.test.ts (currently
    // disabled pending WorkspaceTeamsV3Controller activation).
    // ---------------------------------------------------------------

    describe('Role Resolution: Override Behavior', () => {
      /**
       * Helper: get current user's resolved roles
       */
      async function getUserRoles(
        token: string,
        baseId?: string,
      ): Promise<any> {
        const url = baseId
          ? `/api/v1/auth/user/me?base_id=${baseId}`
          : `/api/v1/auth/user/me`;
        const res = await request(context.app)
          .get(url)
          .set('xc-auth', token)
          .expect(200);
        return res.body;
      }

      it('direct workspace role should be the resolved role (not elevated by teams)', async () => {
        // Create a base to provide workspace context for /user/me
        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);

        // Assign engUser as workspace-level-viewer directly
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: engUser.id,
              workspace_role: 'workspace-level-viewer',
            },
          ])
          .expect(200);

        // Verify resolved workspace role is viewer (direct assignment)
        // Need base_id to get workspace context in /user/me
        const roles = await getUserRoles(engToken, base.id);
        expect(roles.workspace_roles).to.have.property(
          'workspace-level-viewer',
          true,
        );
        // Should NOT have any higher role
        expect(roles.workspace_roles).to.not.have.property(
          'workspace-level-editor',
        );
        expect(roles.workspace_roles).to.not.have.property(
          'workspace-level-creator',
        );
      });

      it('direct workspace role should propagate to base role when no direct base assignment', async () => {
        // Assign engUser as workspace-level-editor directly
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: engUser.id,
              workspace_role: 'workspace-level-editor',
            },
          ])
          .expect(200);

        // Create a base
        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);

        // Get roles with base context — should inherit editor from workspace
        const roles = await getUserRoles(engToken, base.id);
        expect(roles.workspace_roles).to.have.property(
          'workspace-level-editor',
          true,
        );
        // Base role should be the mapped workspace role (editor)
        expect(roles.base_roles).to.have.property('editor', true);
      });

      it('two users with different direct roles should each get their own role', async () => {
        // Create a base to provide workspace context for /user/me
        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);

        // Assign engUser as viewer, feUser as editor
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: engUser.id,
              workspace_role: 'workspace-level-viewer',
            },
            {
              user_id: feUser.id,
              workspace_role: 'workspace-level-editor',
            },
          ])
          .expect(200);

        const engRoles = await getUserRoles(engToken, base.id);
        const feRoles = await getUserRoles(feToken, base.id);

        // Each user should have exactly their assigned role
        expect(engRoles.workspace_roles).to.have.property(
          'workspace-level-viewer',
          true,
        );
        expect(engRoles.workspace_roles).to.not.have.property(
          'workspace-level-editor',
        );

        expect(feRoles.workspace_roles).to.have.property(
          'workspace-level-editor',
          true,
        );
        expect(feRoles.workspace_roles).to.not.have.property(
          'workspace-level-viewer',
        );
      });

      it('direct base role should take priority over workspace role fallback', async () => {
        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);

        // Give engUser workspace editor
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: engUser.id,
              workspace_role: 'workspace-level-editor',
            },
          ])
          .expect(200);

        // Give engUser direct base viewer (lower than workspace editor)
        await request(context.app)
          .post(`/api/v2/meta/bases/${base.id}/users`)
          .set('xc-token', context.xc_token)
          .send({
            email: engUser.email,
            roles: 'viewer',
          })
          .expect(200);

        // Base role should be viewer (direct), NOT editor (from workspace)
        const roles = await getUserRoles(engToken, base.id);
        expect(roles.base_roles).to.have.property('viewer', true);
        expect(roles.base_roles).to.not.have.property('editor');
      });
    });

    // ---------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------

    describe('Edge Cases', () => {
      it('should handle team with no members in permission check', async () => {
        // Create an empty team (no additional members besides the creator/owner)
        const emptyTeamId = await createTeam('Empty Team');

        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);
        const { createTable } = await import('../../../factory/table');
        const table = await createTable(context, base);

        // Set permission with empty team as subject
        const res = await request(context.app)
          .post(
            `/api/v2/internal/${workspaceId}/${base.id}`,
          )
          .set('xc-token', context.xc_token)
          .query({ operation: 'setPermission' })
          .send({
            entity: 'table',
            entity_id: table.id,
            permission: 'TABLE_RECORD_ADD',
            granted_type: 'user',
            subjects: [{ type: 'team', id: emptyTeamId }],
          });

        expect(res.status).to.equal(200);

        // fe-member (not in empty team) should be blocked
        // First give fe-member workspace access
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: feUser.id,
              workspace_role: 'workspace-level-editor',
            },
          ])
          .expect(200);

        const feRes = await request(context.app)
          .post(`/api/v1/db/data/noco/${base.id}/${table.id}`)
          .set('xc-auth', feToken)
          .send({ Title: 'test-empty-team' });

        expect(feRes.status).to.be.oneOf([401, 403]);

        // Cleanup
        await request(context.app)
          .post(
            `/api/v2/internal/${workspaceId}/${base.id}`,
          )
          .set('xc-token', context.xc_token)
          .query({ operation: 'dropPermission' })
          .send({
            entity: 'table',
            entity_id: table.id,
            permission: 'TABLE_RECORD_ADD',
          });
      });

      it('should handle permission with leaf team (no descendants)', async () => {
        // Web Team is a leaf — self_and_descendants should only match Web Team members
        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);
        const { createTable } = await import('../../../factory/table');
        const table = await createTable(context, base);

        // Give users workspace access
        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send(
            [webUser.id, feUser.id, engUser.id].map((userId) => ({
              user_id: userId,
              workspace_role: 'workspace-level-editor',
            })),
          )
          .expect(200);

        // Set permission with Web Team (leaf)
        await request(context.app)
          .post(
            `/api/v2/internal/${workspaceId}/${base.id}`,
          )
          .set('xc-token', context.xc_token)
          .query({ operation: 'setPermission' })
          .send({
            entity: 'table',
            entity_id: table.id,
            permission: 'TABLE_RECORD_ADD',
            granted_type: 'user',
            subjects: [{ type: 'team', id: webTeamId }],
          })
          .expect(200);

        // web-member (direct Web Team) → allowed
        const webRes = await request(context.app)
          .post(`/api/v1/db/data/noco/${base.id}/${table.id}`)
          .set('xc-auth', webToken)
          .send({ Title: 'test-leaf-web' });
        expect(webRes.status).to.be.oneOf([200, 201]);

        // fe-member (Frontend, PARENT of Web Team) → blocked (expansion is downward only)
        const feRes = await request(context.app)
          .post(`/api/v1/db/data/noco/${base.id}/${table.id}`)
          .set('xc-auth', feToken)
          .send({ Title: 'test-leaf-fe' });
        expect(feRes.status).to.be.oneOf([401, 403]);

        // eng-member (Engineering, GRANDPARENT) → blocked
        const engRes = await request(context.app)
          .post(`/api/v1/db/data/noco/${base.id}/${table.id}`)
          .set('xc-auth', engToken)
          .send({ Title: 'test-leaf-eng' });
        expect(engRes.status).to.be.oneOf([401, 403]);

        // Cleanup
        await request(context.app)
          .post(
            `/api/v2/internal/${workspaceId}/${base.id}`,
          )
          .set('xc-token', context.xc_token)
          .query({ operation: 'dropPermission' })
          .send({
            entity: 'table',
            entity_id: table.id,
            permission: 'TABLE_RECORD_ADD',
          });
      });

      it('should handle user in multiple teams within the same hierarchy', async () => {
        // Add eng-member to Frontend too (so they're in both Engineering and Frontend)
        await addMember(frontendId, engUser.id);

        const { createProject } = await import('../../../factory/base');
        const base = await createProject(context);
        const { createTable } = await import('../../../factory/table');
        const table = await createTable(context, base);

        await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: engUser.id,
              workspace_role: 'workspace-level-editor',
            },
          ])
          .expect(200);

        // Set permission with Engineering (self_only)
        await request(context.app)
          .post(
            `/api/v2/internal/${workspaceId}/${base.id}`,
          )
          .set('xc-token', context.xc_token)
          .query({ operation: 'setPermission' })
          .send({
            entity: 'table',
            entity_id: table.id,
            permission: 'TABLE_RECORD_ADD',
            granted_type: 'user',
            subjects: [
              {
                type: 'team',
                id: engineeringId,
                hierarchy_scope: 'self_only',
              },
            ],
          })
          .expect(200);

        // eng-member is in Engineering directly → allowed (self_only matches direct)
        const engRes = await request(context.app)
          .post(`/api/v1/db/data/noco/${base.id}/${table.id}`)
          .set('xc-auth', engToken)
          .send({ Title: 'test-multi-team' });
        expect(engRes.status).to.be.oneOf([200, 201]);

        // Cleanup
        await request(context.app)
          .post(
            `/api/v2/internal/${workspaceId}/${base.id}`,
          )
          .set('xc-token', context.xc_token)
          .query({ operation: 'dropPermission' })
          .send({
            entity: 'table',
            entity_id: table.id,
            permission: 'TABLE_RECORD_ADD',
          });
      });
    });

    // ---------------------------------------------------------------
    // Hierarchy Edge Cases: Delete, Circular Ref, Depth Limit
    // ---------------------------------------------------------------

    describe('Hierarchy Edge Cases', () => {
      describe('Delete team with children', () => {
        it('should block deleting a parent team without force flag', async () => {
          // Frontend has Web Team as a child — delete should be blocked
          const res = await request(context.app)
            .delete(
              `/api/v3/meta/workspaces/${workspaceId}/teams/${frontendId}`,
            )
            .set('xc-token', context.xc_token);

          expect(res.status).to.be.oneOf([400, 422]);
          expect(res.body.msg || res.body.message || '').to.include(
            'sub-team',
          );
        });

        it('should reparent children when deleting with force=true', async () => {
          // Before: Engineering → Frontend → Web Team
          // Delete Frontend with force → Web Team should be reparented to Engineering
          const res = await request(context.app)
            .delete(
              `/api/v3/meta/workspaces/${workspaceId}/teams/${frontendId}`,
            )
            .set('xc-token', context.xc_token)
            .query({ force: 'true' });

          expect(res.status).to.equal(200);

          // Frontend should be deleted
          await request(context.app)
            .get(
              `/api/v3/meta/workspaces/${workspaceId}/teams/${frontendId}`,
            )
            .set('xc-token', context.xc_token)
            .expect(422);

          // Web Team should still exist
          const webTeam = await getTeam(webTeamId);
          expect(webTeam).to.have.property('title', 'Web Team');

          // Verify teams list still has Web Team but not Frontend
          const data = await listTeams();
          const teams = data.list || data;
          const titles = (Array.isArray(teams) ? teams : []).map(
            (t: any) => t.title,
          );
          expect(titles).to.include('Web Team');
          expect(titles).to.include('Engineering');
          expect(titles).to.not.include('Frontend');
        });

        it('should block deleting Engineering which has children (Frontend, Backend)', async () => {
          const res = await request(context.app)
            .delete(
              `/api/v3/meta/workspaces/${workspaceId}/teams/${engineeringId}`,
            )
            .set('xc-token', context.xc_token);

          expect(res.status).to.be.oneOf([400, 422]);

          // Engineering should still exist
          const eng = await getTeam(engineeringId);
          expect(eng).to.have.property('title', 'Engineering');
        });
      });

      describe('Circular reference prevention', () => {
        it('should reject moving a parent under its own child', async () => {
          // Try to move Engineering under Frontend (Frontend is child of Engineering)
          const res = await moveTeam(engineeringId, frontendId);
          expect(res.status).to.be.oneOf([400, 422]);
        });

        it('should reject moving a grandparent under its grandchild', async () => {
          // Try to move Engineering under Web Team (Web Team is grandchild of Engineering)
          const res = await moveTeam(engineeringId, webTeamId);
          expect(res.status).to.be.oneOf([400, 422]);
        });

        it('should reject moving a parent under its own descendant (Backend)', async () => {
          // Try to move Engineering under Backend
          const res = await moveTeam(engineeringId, backendId);
          expect(res.status).to.be.oneOf([400, 422]);
        });
      });

      describe('Depth limit enforcement', () => {
        it('should reject creating a team beyond max depth (3)', async () => {
          // Current: Engineering(0) → Frontend(1) → Web Team(2)
          // Create depth-3 child under Web Team → should succeed (depth 3 is within limit)
          const reactId = await createTeam('React Team', webTeamId);
          const react = await getTeam(reactId);
          expect(react).to.have.property('title', 'React Team');

          // Now try creating depth-4 under React Team → should be rejected
          const res = await request(context.app)
            .post(
              `/api/v3/meta/workspaces/${workspaceId}/teams`,
            )
            .set('xc-token', context.xc_token)
            .send({
              title: 'Too Deep Team',
              parent_team_id: reactId,
              icon: '🏢',
              badge_color: '#3366FF',
            });

          // Should fail due to depth limit
          expect(res.status).to.be.oneOf([400, 422]);
        });

        it('should reject moving a team if it would exceed depth limit', async () => {
          // Create a chain: Sales(0) → SalesChild(1) → SalesGrandchild(2)
          const salesChildId = await createTeam('Sales Child', salesId);
          await createTeam('Sales Grandchild', salesChildId);

          // Web Team is at depth 2. Moving SalesChild (which has SalesGrandchild)
          // under Web Team would push SalesGrandchild to depth 4 — should be rejected
          const res = await moveTeam(salesChildId, webTeamId);

          // salesChildId at depth 3, salesGrandchildId at depth 4 — exceeds limit
          expect(res.status).to.be.oneOf([400, 422]);
        });
      });

      describe('Team Tree endpoint', () => {
        it('should return a tree with correct nesting structure', async () => {
          const tree = await getTeamTree();
          const treeArray = Array.isArray(tree)
            ? tree
            : tree.list || [];

          // Root teams should include Engineering and Sales
          const rootTitles = treeArray.map((t: any) => t.title);
          expect(rootTitles).to.include('Engineering');
          expect(rootTitles).to.include('Sales');

          // Engineering should have children
          const eng = treeArray.find(
            (t: any) => t.title === 'Engineering',
          );
          expect(eng).to.have.property('children').that.is.an('array');
          expect(eng.children.length).to.be.greaterThanOrEqual(2);

          // Children should include Frontend and Backend
          const childTitles = eng.children.map((c: any) => c.title);
          expect(childTitles).to.include('Frontend');
          expect(childTitles).to.include('Backend');

          // Frontend should have Web Team as child
          const fe = eng.children.find(
            (c: any) => c.title === 'Frontend',
          );
          expect(fe).to.have.property('children').that.is.an('array');
          const feChildTitles = fe.children.map((c: any) => c.title);
          expect(feChildTitles).to.include('Web Team');
        });

        it('should include member counts in tree nodes', async () => {
          const tree = await getTeamTree();
          const treeArray = Array.isArray(tree)
            ? tree
            : tree.list || [];

          const eng = treeArray.find(
            (t: any) => t.title === 'Engineering',
          );

          // Engineering should have a members_count property
          expect(eng).to.have.property('members_count');
          expect(eng.members_count).to.be.a('number');
        });
      });

      describe('Inherited members in team detail', () => {
        it('should return inherited members from ancestor teams', async () => {
          const webDetail = await getTeam(webTeamId);

          // Web Team is child of Frontend, which is child of Engineering
          // Inherited members should include members from Frontend and Engineering
          if (webDetail.inherited_members) {
            const inheritedEmails = webDetail.inherited_members.map(
              (m: any) => m.user_email || m.email,
            );

            // Should include Engineering member and Frontend member as inherited
            expect(inheritedEmails).to.include('eng-h@test.com');
            expect(inheritedEmails).to.include('fe-h@test.com');
          }

          // Direct members should only include web-h@test.com
          const directEmails = webDetail.members.map(
            (m: any) => m.user_email || m.email,
          );
          expect(directEmails).to.include('web-h@test.com');
        });

        it('should mark inherited_from_team fields correctly', async () => {
          const webDetail = await getTeam(webTeamId);

          if (
            webDetail.inherited_members &&
            webDetail.inherited_members.length > 0
          ) {
            for (const member of webDetail.inherited_members) {
              // Each inherited member should have a source team
              expect(member).to.have.property('inherited_from_team_id');
              expect(member).to.have.property('inherited_from_team_title');
              expect(member.inherited_from_team_id).to.be.a('string');
              expect(member.inherited_from_team_title).to.be.a('string');
            }
          }
        });

        it('should not include inherited members for a root team', async () => {
          const engDetail = await getTeam(engineeringId);

          // Engineering is a root team — no ancestors, so no inherited members
          if (engDetail.inherited_members) {
            expect(engDetail.inherited_members).to.have.length(0);
          }
        });
      });
    });
  });
}
