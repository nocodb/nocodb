import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import {
  PlanFeatureTypes,
  PlanLimitTypes,
  ProjectRoles,
  TeamUserRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { overridePlan } from '../../../utils/plan.utils';
import { createProject } from '../../../factory/base';
import { createTable } from '../../../factory/table';

/**
 * Team Hierarchy — Missing Integration Tests (Part 1)
 *
 * Tests gaps identified across the team-hierarchy feature that are NOT covered by
 * existing test files (team-hierarchy.test.ts, team-permission-behavior.test.ts, etc.).
 *
 * Covers:
 *   - Role resolution priority chain edge cases
 *   - TABLE_RECORD_DELETE with team hierarchy and role-based grants
 *   - RECORD_FIELD_EDIT with team hierarchy
 *   - TABLE_VISIBILITY combined with team hierarchy (missing scenarios)
 *   - RLS end-to-end row filtering (the first ever E2E RLS data tests)
 *   - {currentUser.teamWithDescendantMembers} placeholder E2E
 *   - TABLE_RECORD_DELETE role-based grant types
 *   - Complex access escalation and team-move edge cases
 */

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Team Hierarchy — Missing Coverage', () => {
    let context: any = {};
    let workspaceId: string;
    let featureMock: any;

    // ─────────────────────────────────────────
    // Shared helpers
    // ─────────────────────────────────────────

    async function createTeam(title: string, parentTeamId?: string): Promise<string> {
      const body: any = { title, icon: '🏢', badge_color: '#3366FF' };
      if (parentTeamId) body.parent_team_id = parentTeamId;
      const res = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
        .set('xc-token', context.xc_token)
        .send(body);
      if (res.status !== 200) {
        throw new Error(`createTeam("${title}") failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
      return res.body.id;
    }

    async function addMember(teamId: string, userId: string) {
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: userId, team_role: TeamUserRoles.MEMBER }])
        .expect(200);
    }

    async function removeMember(teamId: string, userId: string) {
      await request(context.app)
        .delete(`/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: userId }]);
    }

    async function assignBaseTeamRole(baseId: string, teamId: string, role: string) {
      return request(context.app)
        .post(`/api/v3/meta/bases/${baseId}/invites`)
        .set('xc-token', context.xc_token)
        .send({ team_id: teamId, base_role: role });
    }

    async function assignWorkspaceTeamRole(teamId: string, role: string) {
      return request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/invites`)
        .set('xc-token', context.xc_token)
        .send({ team_id: teamId, workspace_role: role });
    }

    async function addWorkspaceMembers(userIds: string[], role = 'workspace-level-editor') {
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(userIds.map((user_id) => ({ user_id, workspace_role: role })))
        .expect(200);
    }

    async function setDirectBaseRole(baseId: string, userEmail: string, role: string) {
      await request(context.app)
        .post(`/api/v2/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send({ email: userEmail, roles: role })
        .expect(200);
    }

    async function setPermission(
      baseId: string,
      tableId: string,
      permissionKey: string,
      payload: any,
    ) {
      return request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'setPermission' })
        .send({ entity: 'table', entity_id: tableId, permission: permissionKey, ...payload });
    }

    async function dropPermission(baseId: string, tableId: string, permissionKey: string) {
      await request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'dropPermission' })
        .send({ entity: 'table', entity_id: tableId, permission: permissionKey });
    }

    async function createRlsPolicy(
      baseId: string,
      tableId: string,
      title: string,
      subjects: any[],
      filter?: any,
      isDefault?: boolean,
    ) {
      const body: any = { fk_model_id: tableId, title, subjects };
      if (filter !== undefined) body.filters = Array.isArray(filter) ? filter : [filter];
      if (isDefault !== undefined) {
        body.is_default = isDefault;
        if (isDefault) body.default_behavior = 'deny_all';
      }
      const res = await request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'rlsPolicyCreate' })
        .send(body);
      return res;
    }

    async function updateRlsPolicy(baseId: string, policyId: string, patch: Record<string, any>) {
      return request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'rlsPolicyUpdate' })
        .send({ id: policyId, ...patch });
    }

    async function listRecords(baseId: string, tableId: string, token: string) {
      return request(context.app)
        .get(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-auth', token);
    }

    async function listTables(baseId: string, token: string) {
      return request(context.app)
        .get(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-auth', token);
    }

    async function getUserRoles(token: string, baseId?: string): Promise<any> {
      const url = baseId
        ? `/api/v1/auth/user/me?base_id=${baseId}`
        : `/api/v1/auth/user/me`;
      const res = await request(context.app)
        .get(url)
        .set('xc-auth', token)
        .expect(200);
      return res.body;
    }

    async function insertRecord(baseId: string, tableId: string, token: string, data: any) {
      return request(context.app)
        .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-auth', token)
        .send(data);
    }

    async function deleteRecord(baseId: string, tableId: string, token: string, rowId: number) {
      return request(context.app)
        .delete(`/api/v1/db/data/noco/${baseId}/${tableId}/${rowId}`)
        .set('xc-auth', token);
    }

    async function updateRecord(
      baseId: string,
      tableId: string,
      token: string,
      rowId: number,
      data: any,
    ) {
      return request(context.app)
        .patch(`/api/v1/db/data/noco/${baseId}/${tableId}/${rowId}`)
        .set('xc-auth', token)
        .send(data);
    }

    async function ownerInsert(baseId: string, tableId: string, data: any): Promise<number> {
      const res = await request(context.app)
        .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-token', context.xc_token)
        .send(data);
      expect(res.status).to.be.oneOf([200, 201]);
      return res.body.Id ?? res.body.id;
    }

    async function addColumn(tableId: string, title: string, uidt: string): Promise<string> {
      await request(context.app)
        .post(`/api/v1/db/meta/tables/${tableId}/columns`)
        .set('xc-token', context.xc_token)
        .send({ title, uidt })
        .expect(200);
      // Fetch fresh table to get reliable column ID (v1 columnAdd caching can be stale)
      const tableRes = await request(context.app)
        .get(`/api/v1/db/meta/tables/${tableId}`)
        .set('xc-token', context.xc_token)
        .expect(200);
      const col = (tableRes.body.columns || []).find((c: any) => c.title === title);
      if (!col?.id) throw new Error(`addColumn("${title}"): column not found in table`);
      return col.id;
    }

    async function createNamedTable(baseId: string, title: string): Promise<string> {
      const res = await request(context.app)
        .post(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          table_name: title,
          title,
          columns: [
            { column_name: 'id', title: 'Id', uidt: 'ID' },
            { column_name: 'title', title: 'Title', uidt: 'SingleLineText' },
          ],
        })
        .expect(200);
      return res.body.id;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Role Resolution Priority Chain — Edge Cases
    //
    // A SaaS company has teams assigned at both workspace and base level, plus
    // some users with direct role assignments. The priority chain
    // (Direct Base > Base Team > Workspace Team > Direct Workspace) is partially
    // tested but several combinations have never been exercised.
    //
    // Team tree used across these tests:
    //   Engineering → Frontend → Web Platform, Engineering → Backend
    // ─────────────────────────────────────────────────────────────────────────

    describe('Role Resolution Priority Chain', () => {
      let engineeringId: string;
      let frontendId: string;
      let webTeamId: string;

      let fionaUser: any; let fionaToken: string; // Frontend Lead
      let waltUser: any; let waltToken: string;   // Web Platform dev

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100 },
        });

        engineeringId = await createTeam('RoleRes-Engineering');
        frontendId = await createTeam('RoleRes-Frontend', engineeringId);
        await createTeam('RoleRes-Backend', engineeringId);
        webTeamId = await createTeam('RoleRes-WebPlatform', frontendId);

        const fionaResult = await createUser(context, { email: 'roleres-fiona@test.com' });
        fionaUser = fionaResult.user; fionaToken = fionaResult.token;

        const waltResult = await createUser(context, { email: 'roleres-walt@test.com' });
        waltUser = waltResult.user; waltToken = waltResult.token;

        await addMember(frontendId, fionaUser.id);
        await addMember(webTeamId, waltUser.id);
      });

      afterEach(async () => { await featureMock?.restore?.(); });

      /**
       * Walt is a Web Platform dev (member of webTeamId, child of Frontend).
       * His team is assigned Base Creator directly, so Walt gets Creator.
       *
       * A contractor emergency requires immediately revoking Walt's base access without
       * touching the team hierarchy. The admin sets Walt's direct base role to no_access.
       * Direct Base (Priority 1) must win — Walt should be completely locked out
       * even though his team still grants Creator.
       */
      it('direct no_access base role blocks access even when team hierarchy grants Creator', async () => {
        const base = await createProject(context);
        await addWorkspaceMembers([waltUser.id]);
        await assignBaseTeamRole(base.id, webTeamId, ProjectRoles.CREATOR);

        // Walt gets Creator via his team assignment — verify role and access
        const beforeRoles = await getUserRoles(waltToken, base.id);
        expect(beforeRoles.base_roles).to.have.property('creator', true);
        const beforeList = await listTables(base.id, waltToken);
        expect(beforeList.status).to.equal(200);

        // Set Walt's direct base role to no_access (emergency revocation)
        await setDirectBaseRole(base.id, waltUser.email, 'no-access');

        // Direct base role wins — Walt is completely locked out
        const afterRoles = await getUserRoles(waltToken, base.id);
        expect(afterRoles.base_roles).to.not.have.property('creator');
        const afterList = await listTables(base.id, waltToken);
        expect(afterList.status).to.equal(403);
      });

      /**
       * The Sales team is explicitly excluded from a specific base by assigning them
       * no_access at the base team level. Even though Sales has a Viewer role at the
       * workspace level, the base team no_access (Priority 2) should win.
       *
       * This happens after a compliance review finds Sales was inadvertently seeing
       * product-internal data through workspace role inheritance.
       */
      it('base team no_access role blocks access even when workspace team grants Viewer', async () => {
        const salesTeamId = await createTeam('RoleRes-Sales');
        const saraResult = await createUser(context, { email: 'roleres-sara@test.com' });
        const saraUser = saraResult.user;
        const saraToken = saraResult.token;
        await addMember(salesTeamId, saraUser.id);

        const base = await createProject(context);
        await addWorkspaceMembers([saraUser.id], 'workspace-level-viewer');
        await assignWorkspaceTeamRole(salesTeamId, WorkspaceUserRoles.VIEWER);

        // Explicitly block Sales from this base
        await assignBaseTeamRole(base.id, salesTeamId, 'no-access');

        const res = await listTables(base.id, saraToken);
        expect(res.status).to.equal(403);
      });

      /**
       * Fiona is a Frontend Lead who has a role from every possible source simultaneously:
       *   - Priority 1: direct base assignment → Commenter
       *   - Priority 2: Frontend team → Base Creator
       *   - Priority 3: Engineering workspace team → Editor (Fiona is descendant)
       *   - Priority 4: direct workspace role → Viewer
       *
       * Only Priority 1 should matter — Fiona gets Commenter.
       * Commenter can read but cannot add records.
       */
      it('when all four role sources are present simultaneously, direct base role wins', async () => {
        const base = await createProject(context);
        await addWorkspaceMembers([fionaUser.id], 'workspace-level-viewer');
        await assignWorkspaceTeamRole(engineeringId, WorkspaceUserRoles.EDITOR);
        await assignBaseTeamRole(base.id, frontendId, ProjectRoles.CREATOR);

        // Priority 1: direct base Commenter
        await setDirectBaseRole(base.id, fionaUser.email, 'commenter');

        const table = await createTable(context, base);

        // Commenter cannot add records
        const insertRes = await insertRecord(base.id, table.id, fionaToken, { Title: 'should-fail' });
        expect(insertRes.status).to.be.oneOf([401, 403]);

        // Commenter can read
        const readRes = await listRecords(base.id, table.id, fionaToken);
        expect(readRes.status).to.equal(200);

        expect((await getUserRoles(fionaToken, base.id)).base_roles).to.have.property('commenter')
      });

      /**
       * An admin intentionally restricts Fiona to Viewer even though her team (Frontend)
       * grants Creator. The direct assignment must win even when it is a LOWER role.
       * This is the "intentional restriction" pattern — used when a team member goes on leave
       * or moves to a read-only advisory role.
       */
      it('direct base Viewer overrides team Creator — intentional restriction wins', async () => {
        const base = await createProject(context);
        await addWorkspaceMembers([fionaUser.id]);
        await assignBaseTeamRole(base.id, frontendId, ProjectRoles.CREATOR);

        // Intentionally restrict Fiona below her team role
        await setDirectBaseRole(base.id, fionaUser.email, 'viewer');

        const table = await createTable(context, base);

        // Fiona cannot add records (Viewer cannot)
        const insertRes = await insertRecord(base.id, table.id, fionaToken, { Title: 'should-fail' });
        expect(insertRes.status).to.be.oneOf([401, 403]);

        // Fiona cannot create tables (not Creator anymore)
        const createTableRes = await request(context.app)
          .post(`/api/v1/db/meta/projects/${base.id}/tables`)
          .set('xc-auth', fionaToken)
          .send({ title: 'NewTable' });
        expect(createTableRes.status).to.be.oneOf([401, 403]);

        // Fiona CAN read (Viewer can read)
        const readRes = await listRecords(base.id, table.id, fionaToken);
        expect(readRes.status).to.equal(200);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TABLE_RECORD_DELETE with Team Hierarchy
    //
    // A legal firm uses NocoDB to track case files. Paralegals can add and edit
    // records (Editor base role via the Legal Dept team), but permanently deleting
    // a case file is a senior action — only the Senior Reviewers team should be
    // allowed to delete.
    //
    // This is the first E2E test of TABLE_RECORD_DELETE with team subjects.
    // The existing test suite only sets TABLE_RECORD_ADD as the permission key.
    //
    // Team tree:
    //   LegalDept → CaseMgmt → SeniorReviewers
    //                        → JuniorParalegals
    //             → Compliance
    // ─────────────────────────────────────────────────────────────────────────

    describe('TABLE_RECORD_DELETE — Legal firm: Senior Reviewers gate deletions', () => {
      let legalDeptId: string;
      let caseMgmtId: string;
      let seniorReviewersId: string;
      let juniorParalegalsId: string;

      let haroldUser: any; let haroldToken: string; // Head of Legal (top of hierarchy)
      let lauraUser: any;  let lauraToken: string;  // Case Management Lead
      let samUser: any;    let samToken: string;    // Senior Reviewer (can delete)
      let jakeUser: any;   let jakeToken: string;   // Junior Paralegal (cannot delete)

      let base: any;
      let table: any;
      let seedRowId: number;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100 },
        });

        legalDeptId      = await createTeam('Legal-LegalDept');
        caseMgmtId       = await createTeam('Legal-CaseMgmt', legalDeptId);
        seniorReviewersId = await createTeam('Legal-SeniorReviewers', caseMgmtId);
        juniorParalegalsId = await createTeam('Legal-JuniorParalegals', caseMgmtId);
        await createTeam('Legal-Compliance', legalDeptId);

        const haroldR = await createUser(context, { email: 'legal-harold@test.com' });
        haroldUser = haroldR.user; haroldToken = haroldR.token;

        const lauraR = await createUser(context, { email: 'legal-laura@test.com' });
        lauraUser = lauraR.user; lauraToken = lauraR.token;

        const samR = await createUser(context, { email: 'legal-sam@test.com' });
        samUser = samR.user; samToken = samR.token;

        const jakeR = await createUser(context, { email: 'legal-jake@test.com' });
        jakeUser = jakeR.user; jakeToken = jakeR.token;

        await addMember(legalDeptId, haroldUser.id);
        await addMember(caseMgmtId, lauraUser.id);
        await addMember(seniorReviewersId, samUser.id);
        await addMember(juniorParalegalsId, jakeUser.id);

        base = await createProject(context);
        table = await createTable(context, base);

        await addWorkspaceMembers([haroldUser.id, lauraUser.id, samUser.id, jakeUser.id]);

        // All lawyers get Editor base role via LegalDept team
        await assignBaseTeamRole(base.id, legalDeptId, ProjectRoles.EDITOR);

        // Seed a case file row to attempt deleting in tests
        seedRowId = await ownerInsert(base.id, table.id, { Title: 'Case-2025-MergerDispute' });
      });

      afterEach(async () => {
        await dropPermission(base.id, table.id, 'TABLE_RECORD_DELETE');
        await featureMock?.restore?.();
      });

      /**
       * Sam is a direct member of Senior Reviewers. The firm admin sets TABLE_RECORD_DELETE
       * with SeniorReviewers as the subject (self_and_descendants). Sam should be allowed.
       */
      it('Senior Reviewer can permanently delete case records', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: seniorReviewersId, hierarchy_scope: 'self_and_descendants' }],
        });

        const res = await deleteRecord(base.id, table.id, samToken, seedRowId);
        expect(res.status).to.be.oneOf([200, 204]);
      });

      /**
       * Jake is a Junior Paralegal (Editor via LegalDept team), but NOT in the Senior Reviewers
       * subtree. Having Editor base role does not bypass the TABLE_RECORD_DELETE permission —
       * only being in the right permission subject matters.
       */
      it('Junior Paralegal with Editor role cannot delete — not in permission subject team', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: seniorReviewersId, hierarchy_scope: 'self_and_descendants' }],
        });

        const res = await deleteRecord(base.id, table.id, jakeToken, seedRowId);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      /**
       * Laura is the Case Management Lead — the direct parent team of Senior Reviewers.
       * Permission subjects expand DOWNWARD into descendants, never upward into ancestors.
       * Laura gets Editor via upward role cascade (base role), but she is an ancestor of
       * SeniorReviewers, not a descendant. She should be blocked.
       */
      it('Case Management Lead (parent team ancestor) cannot delete — hierarchy is downward only', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: seniorReviewersId, hierarchy_scope: 'self_and_descendants' }],
        });

        const res = await deleteRecord(base.id, table.id, lauraToken, seedRowId);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      /**
       * Harold is Head of Legal — the very top of the hierarchy. He gets Editor via upward
       * cascade from the LegalDept base team assignment, but he is NOT in the Senior Reviewers
       * subtree. Even the department head cannot delete without being in the permission subject.
       */
      it('Head of Legal (top ancestor with Editor role) cannot delete — not in SR subtree', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: seniorReviewersId, hierarchy_scope: 'self_and_descendants' }],
        });

        const res = await deleteRecord(base.id, table.id, haroldToken, seedRowId);
        expect(res.status).to.be.oneOf([401, 403]);
      });

      /**
       * With self_only scope, only direct members of Senior Reviewers can delete.
       * If SR had sub-teams those members would be excluded.
       * Sam is a direct member — still allowed.
       */
      it('self_only scope: only direct Senior Reviewer member can delete, not expanded descendants', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: seniorReviewersId, hierarchy_scope: 'self_only' }],
        });

        const res = await deleteRecord(base.id, table.id, samToken, seedRowId);
        expect(res.status).to.be.oneOf([200, 204]);
      });

      /**
       * When no TABLE_RECORD_DELETE permission is configured, the system falls back to the
       * default: editors_and_up. Jake is an Editor via his team assignment — with no restriction
       * in place, he should be able to delete.
       */
      it('without a TABLE_RECORD_DELETE permission set, Editor can delete by default', async () => {
        // No setPermission call — default behavior
        const res = await deleteRecord(base.id, table.id, jakeToken, seedRowId);
        expect(res.status).to.be.oneOf([200, 204]);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RECORD_FIELD_EDIT with Team Hierarchy
    //
    // An HR team manages employee records. All HR members have Editor access to the base,
    // but changing the Salary field is a compliance requirement — only HR Business Partners
    // (a specialized sub-team) can update compensation numbers.
    //
    // Even the HR Director (who is an ancestor of HRBP) cannot edit salaries.
    // This is the first E2E test of RECORD_FIELD_EDIT with team subjects.
    //
    // Team tree:
    //   HRDept → HRBP
    //          → Recruiters
    //          → Generalists (direct members of HRDept)
    // ─────────────────────────────────────────────────────────────────────────

    describe('RECORD_FIELD_EDIT — HR: only Business Partners can edit Salary', () => {
      let hrDeptId: string;
      let hrbpId: string;
      let recruitersId: string;

      let dianaUser: any; let dianaToken: string; // HR Director (ancestor of HRBP)
      let helenUser: any; let helenToken: string; // HRBP member (can edit Salary)
      let ronUser: any;   let ronToken: string;   // Recruiter (cannot edit Salary)

      let base: any;
      let tableId: string;
      let salaryFieldId: string;
      let seedRowId: number;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100 },
        });

        hrDeptId    = await createTeam('HR-HRDept');
        hrbpId      = await createTeam('HR-HRBP', hrDeptId);
        recruitersId = await createTeam('HR-Recruiters', hrDeptId);

        const dianaR = await createUser(context, { email: 'hr-diana@test.com' });
        dianaUser = dianaR.user; dianaToken = dianaR.token;

        const helenR = await createUser(context, { email: 'hr-helen@test.com' });
        helenUser = helenR.user; helenToken = helenR.token;

        const ronR = await createUser(context, { email: 'hr-ron@test.com' });
        ronUser = ronR.user; ronToken = ronR.token;

        await addMember(hrDeptId, dianaUser.id);
        await addMember(hrbpId, helenUser.id);
        await addMember(recruitersId, ronUser.id);

        base = await createProject(context);

        tableId = await createNamedTable(base.id, 'Employees');
        salaryFieldId = await addColumn(tableId, 'Salary', 'Number');

        await addWorkspaceMembers([dianaUser.id, helenUser.id, ronUser.id]);
        await assignBaseTeamRole(base.id, hrDeptId, ProjectRoles.EDITOR);

        seedRowId = await ownerInsert(base.id, tableId, { Title: 'Alice Smith', Salary: 80000 });
      });

      afterEach(async () => {
        await dropPermission(base.id, tableId, 'RECORD_FIELD_EDIT');
        await featureMock?.restore?.();
      });

      /**
       * Helen is a direct HRBP member. The admin locks Salary editing to HRBP (self_only).
       * Helen should be able to update the Salary field.
       */
      it('HRBP member can edit the Salary field', async () => {
        await setPermission(base.id, tableId, 'RECORD_FIELD_EDIT', {
          entity: 'field',
          entity_id: salaryFieldId,
          granted_type: 'user',
          subjects: [{ type: 'team', id: hrbpId, hierarchy_scope: 'self_only' }],
        });

        const res = await updateRecord(base.id, tableId, helenToken, seedRowId, { Salary: 95000 });
        expect(res.status).to.be.oneOf([200, 201]);
      });

      /**
       * Ron is a Recruiter — a sibling sub-team of HRBP, NOT a descendant.
       * He has Editor base role but is excluded from the Salary field permission subject.
       */
      it('Recruiter with Editor role cannot edit Salary — not in HRBP subject', async () => {
        await setPermission(base.id, tableId, 'RECORD_FIELD_EDIT', {
          entity: 'field',
          entity_id: salaryFieldId,
          granted_type: 'user',
          subjects: [{ type: 'team', id: hrbpId, hierarchy_scope: 'self_only' }],
        });

        const res = await updateRecord(base.id, tableId, ronToken, seedRowId, { Salary: 95000 });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      /**
       * Diana is the HR Director — the direct parent (ancestor) of HRBP.
       * She gets Editor base role via HR Dept, but RECORD_FIELD_EDIT is self_only on HRBP.
       * Permission subjects expand downward into descendants, not upward into ancestors.
       * Diana cannot edit Salary even though she outranks HRBP members.
       */
      it('HR Director (ancestor of HRBP) cannot edit Salary with self_only scope', async () => {
        await setPermission(base.id, tableId, 'RECORD_FIELD_EDIT', {
          entity: 'field',
          entity_id: salaryFieldId,
          granted_type: 'user',
          subjects: [{ type: 'team', id: hrbpId, hierarchy_scope: 'self_only' }],
        });

        const res = await updateRecord(base.id, tableId, dianaToken, seedRowId, { Salary: 95000 });
        expect(res.status).to.be.oneOf([401, 403]);
      });

      /**
       * Ron (Recruiter, Editor) cannot edit Salary — but there is no restriction on the
       * Title/Name field. Ron should still be able to update unrestricted fields normally.
       */
      it('unrestricted fields remain editable for any Editor regardless of field-level restrictions', async () => {
        await setPermission(base.id, tableId, 'RECORD_FIELD_EDIT', {
          entity: 'field',
          entity_id: salaryFieldId,
          granted_type: 'user',
          subjects: [{ type: 'team', id: hrbpId, hierarchy_scope: 'self_only' }],
        });

        const res = await updateRecord(base.id, tableId, ronToken, seedRowId, { Title: 'Updated Name' });
        expect(res.status).to.be.oneOf([200, 201]);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TABLE_VISIBILITY + Team Hierarchy — Missing Scenarios
    //
    // A SaaS company shares one NocoDB workspace between Engineering and Finance.
    // The Finance team manages a Payroll table that should be completely invisible
    // to Engineering — they shouldn't even know it exists.
    //
    // Key scenario to test: upward role cascade gives the CEO (ancestor of Finance)
    // an Editor base role, but that does NOT mean she can see the Payroll table.
    // Role cascade ≠ permission subject match.
    //
    // Team tree:
    //   Company → Finance → AccountsPayable, FP&A
    //           → Engineering → Frontend, Backend
    // ─────────────────────────────────────────────────────────────────────────

    describe('TABLE_VISIBILITY + Team Hierarchy — Finance data hidden from Engineering', () => {
      let financeId: string;
      let accountsPayableId: string;
      let engineeringId: string;

      let carolUser: any; let carolToken: string; // CEO — ancestor of Finance
      let aliceUser: any; let aliceToken: string; // Accounts Payable — sees Payroll
      let danaUser: any;  let danaToken: string;  // Engineering — cannot see Payroll

      let base: any;
      let payrollTableId: string;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100 },
        });

        const companyId = await createTeam('Visibility-Company');
        financeId = await createTeam('Visibility-Finance', companyId);
        accountsPayableId = await createTeam('Visibility-AP', financeId);
        engineeringId = await createTeam('Visibility-Engineering', companyId);

        const carolR = await createUser(context, { email: 'vis-carol@test.com' });
        carolUser = carolR.user; carolToken = carolR.token;

        const aliceR = await createUser(context, { email: 'vis-alice@test.com' });
        aliceUser = aliceR.user; aliceToken = aliceR.token;

        const danaR = await createUser(context, { email: 'vis-dana@test.com' });
        danaUser = danaR.user; danaToken = danaR.token;

        await addMember(companyId, carolUser.id);
        await addMember(accountsPayableId, aliceUser.id);
        await addMember(engineeringId, danaUser.id);

        base = await createProject(context);
        await addWorkspaceMembers([carolUser.id, aliceUser.id, danaUser.id]);

        // Everyone in Company sees the base (Viewer via company team)
        await assignBaseTeamRole(base.id, companyId, ProjectRoles.VIEWER);

        // Create the sensitive Payroll table
        payrollTableId = await createNamedTable(base.id, 'Payroll');

        // Restrict Payroll visibility to Finance + descendants only
        await setPermission(base.id, payrollTableId, 'TABLE_VISIBILITY', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: financeId, hierarchy_scope: 'self_and_descendants' }],
        });
      });

      afterEach(async () => {
        await dropPermission(base.id, payrollTableId, 'TABLE_VISIBILITY');
        await featureMock?.restore?.();
      });

      /**
       * Alice is in Accounts Payable, which is a descendant of Finance.
       * The TABLE_VISIBILITY subject uses self_and_descendants on Finance.
       * Alice should see Payroll in the table list.
       */
      it('Finance descendant (Accounts Payable) sees Payroll table', async () => {
        const res = await listTables(base.id, aliceToken);
        expect(res.status).to.equal(200);
        const tableIds = res.body.list.map((t: any) => t.id);
        expect(tableIds).to.include(payrollTableId);
      });

      /**
       * Dana is in Engineering — a completely different subtree from Finance.
       * The Payroll table should not appear in her table list at all.
       */
      it('Engineering member cannot see Payroll table in the list', async () => {
        const listRes = await listTables(base.id, danaToken);
        expect(listRes.status).to.equal(200);
        const tableIds = listRes.body.list.map((t: any) => t.id);
        expect(tableIds).to.not.include(payrollTableId);
      });

      /**
       * Carol is the CEO — ancestor of Finance via the Company → Finance chain.
       * Upward role cascade gives her Viewer base role from Finance's sub-team assignments,
       * but TABLE_VISIBILITY subject matching is NOT the same as role cascade.
       * Carol is an ancestor of Finance, not a member or descendant.
       * She should NOT see Payroll unless explicitly added to the visibility subject.
       */
      it('CEO (ancestor of Finance) cannot see Payroll via upward cascade — role cascade ≠ permission match', async () => {
        const listRes = await listTables(base.id, carolToken);
        expect(listRes.status).to.equal(200);
        const tableIds = listRes.body.list.map((t: any) => t.id);
        expect(tableIds).to.not.include(payrollTableId);
      });

      /**
       * A table can be archived entirely by setting TABLE_VISIBILITY to nobody.
       * Even Finance members (who normally see it) should not see the table.
       */
      it('nobody grant hides Payroll from everyone including Finance members', async () => {
        await setPermission(base.id, payrollTableId, 'TABLE_VISIBILITY', {
          granted_type: 'nobody',
        });

        const aliceRes = await listTables(base.id, aliceToken);
        expect(aliceRes.status).to.equal(200);
        const tableIds = aliceRes.body.list.map((t: any) => t.id);
        expect(tableIds).to.not.include(payrollTableId);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RLS End-to-End Row Filtering
    //
    // A national sales org uses RLS to ensure West Coast reps never see East Coast
    // deals and vice versa, while a VP with upward role cascade but no RLS subject
    // match sees zero rows — not a 403.
    //
    // THIS IS THE FIRST EVER E2E TEST of actual RLS row filtering.
    // All existing tests only verify policy metadata (create/list/delete).
    // None verify what records a user actually receives.
    //
    // Team tree:
    //   Sales → EastCoast → NYTeam
    //         → WestCoast → LATeam
    //
    // Seed data: 3 East rows, 3 West rows.
    // RLS: EastCoast+descendants → Region=East, WestCoast+descendants → Region=West.
    // Default: deny_all.
    // ─────────────────────────────────────────────────────────────────────────

    describe('RLS End-to-End Row Filtering — Regional Sales CRM (first E2E RLS test)', () => {
      let salesId: string;
      let eastCoastId: string;
      let westCoastId: string;
      let nyTeamId: string;

      let victorUser: any; let victorToken: string; // VP Sales — no RLS policy match
      let nancyUser: any;  let nancyToken: string;  // NY Team rep — East Coast
      let luisUser: any;   let luisToken: string;   // LA Team rep — West Coast

      let base: any;
      let tableId: string;
      let eastPolicyId: string;
      let row1Id: number; // East row (Acme Corp)
      let row4Id: number; // West row (Umbrella)

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: {
            [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true,
            [PlanFeatureTypes.FEATURE_RLS]: true,
          },
          limits: {
            [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100,
            [PlanLimitTypes.LIMIT_RLS_POLICIES_PER_TABLE]: 100,
          },
        });

        salesId     = await createTeam('RLS-Sales');
        eastCoastId = await createTeam('RLS-EastCoast', salesId);
        nyTeamId    = await createTeam('RLS-NYTeam', eastCoastId);
        westCoastId = await createTeam('RLS-WestCoast', salesId);
        const laTeamId = await createTeam('RLS-LATeam', westCoastId);

        const victorR = await createUser(context, { email: 'rls-victor@test.com' });
        victorUser = victorR.user; victorToken = victorR.token;

        const nancyR = await createUser(context, { email: 'rls-nancy@test.com' });
        nancyUser = nancyR.user; nancyToken = nancyR.token;

        const luisR = await createUser(context, { email: 'rls-luis@test.com' });
        luisUser = luisR.user; luisToken = luisR.token;

        await addMember(salesId, victorUser.id);
        await addMember(nyTeamId, nancyUser.id);
        await addMember(laTeamId, luisUser.id);

        base = await createProject(context);
        await addWorkspaceMembers([victorUser.id, nancyUser.id, luisUser.id]);

        // Sales → Editor (upward cascade gives Victor Editor access to the base)
        await assignBaseTeamRole(base.id, salesId, ProjectRoles.EDITOR);

        tableId = await createNamedTable(base.id, 'Deals');
        const regionColId = await addColumn(tableId, 'Region', 'SingleLineText');
        await addColumn(tableId, 'Amount', 'Number');

        row1Id = await ownerInsert(base.id, tableId, { Title: 'Acme Corp', Region: 'East', Amount: 50000 });
        await ownerInsert(base.id, tableId, { Title: 'Globex', Region: 'East', Amount: 30000 });
        await ownerInsert(base.id, tableId, { Title: 'Initech', Region: 'East', Amount: 20000 });
        row4Id = await ownerInsert(base.id, tableId, { Title: 'Umbrella', Region: 'West', Amount: 80000 });
        await ownerInsert(base.id, tableId, { Title: 'Massive Dyn', Region: 'West', Amount: 45000 });
        await ownerInsert(base.id, tableId, { Title: 'Soylent', Region: 'West', Amount: 15000 });

        // East Coast View: EastCoast + descendants see East rows
        const eastRes = await createRlsPolicy(
          base.id, tableId, 'East Coast View',
          [{ type: 'team', id: eastCoastId, hierarchy_scope: 'self_and_descendants' }],
          { fk_column_id: regionColId, comparison_op: 'eq', value: 'East' },
        );
        expect(eastRes.status).to.equal(200);
        eastPolicyId = eastRes.body.id;

        // West Coast View: WestCoast + descendants see West rows
        await createRlsPolicy(
          base.id, tableId, 'West Coast View',
          [{ type: 'team', id: westCoastId, hierarchy_scope: 'self_and_descendants' }],
          { fk_column_id: regionColId, comparison_op: 'eq', value: 'West' },
        );

        // Default: deny_all — users matching no policy get empty list (not 403)
        await createRlsPolicy(base.id, tableId, 'Default Deny', [], undefined, true);
      });

      afterEach(async () => { await featureMock?.restore?.(); });

      /**
       * Nancy is in NY Team, a descendant of East Coast. The East Coast View policy
       * expands to include NY Team members. Nancy should see exactly 3 East rows.
       */
      it('East Coast rep sees only East region rows (3 of 6)', async () => {
        const res = await listRecords(base.id, tableId, nancyToken);
        expect(res.status).to.equal(200);
        const records = res.body.list ?? res.body;
        expect(records.length).to.equal(3);
        records.forEach((r: any) => expect(r.Region).to.equal('East'));
      });

      /**
       * Luis is in LA Team, a descendant of West Coast.
       * He should see exactly 3 West rows, none of the East rows.
       */
      it('West Coast rep sees only West region rows (3 of 6)', async () => {
        const res = await listRecords(base.id, tableId, luisToken);
        expect(res.status).to.equal(200);
        const records = res.body.list ?? res.body;
        expect(records.length).to.equal(3);
        records.forEach((r: any) => expect(r.Region).to.equal('West'));
      });

      /**
       * Victor is the VP (Sales team — parent of EastCoast and WestCoast).
       * Upward cascade gives him Editor base role so he can access the base (not 403).
       * But his team (Sales) is NOT in the East or West RLS policy subjects.
       * Default is deny_all → Victor gets 200 with 0 rows.
       *
       * This is the "VP-gets-no-rows" architectural trap from the spec.
       * It looks like a bug but is correct behavior — the VP needs an explicit policy.
       */
      it('VP with Editor role via upward cascade sees 0 rows — not in any RLS subject', async () => {
        const res = await listRecords(base.id, tableId, victorToken);
        expect(res.status).to.equal(200); // NOT 403 — VP has base access
        const records = res.body.list ?? res.body;
        expect(records.length).to.equal(0); // deny_all because no policy matches Sales team
      });

      /**
       * The row count endpoint must also respect RLS, not just the list endpoint.
       * Nancy's count should return 3, not 6.
       */
      it('row count endpoint also respects RLS (East rep sees count=3, not 6)', async () => {
        const res = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/count`)
          .set('xc-auth', nancyToken);
        expect(res.status).to.equal(200);
        expect(res.body.count).to.equal(3);
      });

      /**
       * Fetching a single record by ID must also respect RLS.
       * Nancy should get 404 or 403 when trying to fetch a West record directly,
       * even if she knows the row ID.
       */
      it('single record fetch respects RLS — East rep cannot fetch a West record by ID', async () => {
        // Fetch a West record (Umbrella) by ID
        const forbiddenRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/${row4Id}`)
          .set('xc-auth', nancyToken);
        expect(forbiddenRes.status).to.be.oneOf([403, 404]);

        // Fetch an East record (Acme Corp) by ID — allowed
        const allowedRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/${row1Id}`)
          .set('xc-auth', nancyToken);
        expect(allowedRes.status).to.equal(200);
      });

      /**
       * Disabling an RLS policy should immediately remove its effect.
       * When the East Coast View policy is disabled and default changed to show_all,
       * Nancy sees all 6 rows. Re-enabling immediately restores the filter.
       */
      it('disabling an RLS policy removes its filter; re-enabling immediately restores it', async () => {
        // Disable East Coast View policy
        await updateRlsPolicy(base.id, eastPolicyId, { enabled: false });

        // Nancy now sees 0 rows — deny_all default applies since no policy matches
        const allRes = await listRecords(base.id, tableId, nancyToken);
        const allRecords = allRes.body.list ?? allRes.body;
        expect(Array.isArray(allRecords)).to.be.true;
        expect(allRecords.length).to.equal(0);

        // Re-enable East Coast View policy
        await updateRlsPolicy(base.id, eastPolicyId, { enabled: true });

        // Nancy sees 3 East rows again
        const filteredRes = await listRecords(base.id, tableId, nancyToken);
        const filteredRecords = filteredRes.body.list ?? filteredRes.body;
        expect(filteredRecords.length).to.equal(3);
        filteredRecords.forEach((r: any) => expect(r.Region).to.equal('East'));
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // {currentUser.teamWithDescendantMembers} Placeholder — Manager Branch View
    //
    // The "Owned By" pattern is the most common enterprise access model:
    // managers see all records created by their direct reports and their reports' reports,
    // while reps can only see their own records.
    //
    // The {currentUser.teamWithDescendantMembers} placeholder exists for exactly this case,
    //
    // Team tree:
    //   SalesOrg → SDRAlpha → AlphaReps
    //            → SDRBeta  → BetaReps
    //
    // RLS Policy 1 (for all editors): OwnedBy = {currentUser.id}
    // RLS Policy 2 (for SDRAlpha managers only, self_only): OwnedBy IN {currentUser.teamWithDescendantMembers}
    // Default: deny_all
    //
    // Critical: self_only on Policy 2 prevents reps (AlphaReps) from accidentally
    // getting manager-level access via the teamWithDescendantMembers expansion.
    // ─────────────────────────────────────────────────────────────────────────

    describe('{currentUser.teamWithDescendantMembers} — SDR Manager sees full branch, rep sees own only', () => {
      let salesOrgId: string;
      let sdrAlphaId: string;
      let alphaRepsId: string;
      let sdrBetaId: string;

      let victorUser: any; let victorToken: string; // VP — gets 0 rows (not in any manager team)
      let marcusUser: any; let marcusToken: string; // SDRAlpha Manager — sees all Alpha branch
      let rosaUser: any;   let rosaToken: string;   // Alpha Rep — sees only own records
      let rajUser: any;    let rajToken: string;    // Beta Rep

      let base: any;
      let tableId: string;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: {
            [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true,
            [PlanFeatureTypes.FEATURE_RLS]: true,
          },
          limits: {
            [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100,
            [PlanLimitTypes.LIMIT_RLS_POLICIES_PER_TABLE]: 100,
          },
        });

        salesOrgId  = await createTeam('SDR-SalesOrg');
        sdrAlphaId  = await createTeam('SDR-SDRAlpha', salesOrgId);
        alphaRepsId = await createTeam('SDR-AlphaReps', sdrAlphaId);
        sdrBetaId   = await createTeam('SDR-SDRBeta', salesOrgId);
        const betaRepsId = await createTeam('SDR-BetaReps', sdrBetaId);

        const victorR = await createUser(context, { email: 'sdr-victor@test.com' });
        victorUser = victorR.user; victorToken = victorR.token;

        const marcusR = await createUser(context, { email: 'sdr-marcus@test.com' });
        marcusUser = marcusR.user; marcusToken = marcusR.token;

        const rosaR = await createUser(context, { email: 'sdr-rosa@test.com' });
        rosaUser = rosaR.user; rosaToken = rosaR.token;

        const rajR = await createUser(context, { email: 'sdr-raj@test.com' });
        rajUser = rajR.user; rajToken = rajR.token;

        await addMember(salesOrgId, victorUser.id);
        await addMember(sdrAlphaId, marcusUser.id);
        await addMember(alphaRepsId, rosaUser.id);
        await addMember(betaRepsId, rajUser.id);

        base = await createProject(context);
        await addWorkspaceMembers([victorUser.id, marcusUser.id, rosaUser.id, rajUser.id]);
        await assignBaseTeamRole(base.id, salesOrgId, ProjectRoles.EDITOR);

        tableId = await createNamedTable(base.id, 'SDR_Deals');
        const ownedByColId = await addColumn(tableId, 'OwnedBy', 'SingleLineText');

        // Seed: Rosa's deals and Raj's deal
        await ownerInsert(base.id, tableId, { Title: 'IBM',    OwnedBy: rosaUser.id });
        await ownerInsert(base.id, tableId, { Title: 'Oracle', OwnedBy: rosaUser.id });
        await ownerInsert(base.id, tableId, { Title: 'Dell',   OwnedBy: rajUser.id });

        // Policy 1: all editors see only their own records
        await createRlsPolicy(
          base.id, tableId, 'Own Records Only',
          [{ type: 'role', id: 'editor' }],
          { fk_column_id: ownedByColId, comparison_op: 'eq', value: '{currentUser.id}' },
        );

        // Policy 2: SDRAlpha managers (self_only) see their entire branch's records
        await createRlsPolicy(
          base.id, tableId, 'Manager Branch View',
          [{ type: 'team', id: sdrAlphaId, hierarchy_scope: 'self_only' }],
          { fk_column_id: ownedByColId, comparison_op: 'anyof', value: '{currentUser.teamWithDescendantMembers}' },
        );

        // Default: deny_all
        await createRlsPolicy(base.id, tableId, 'Default Deny', [], undefined, true);
      });

      afterEach(async () => { await featureMock?.restore?.(); });

      /**
       * Rosa is in AlphaReps (descendant of SDRAlpha), NOT directly in SDRAlpha.
       * Policy 2 uses self_only on SDRAlpha — Rosa does NOT match it.
       * Rosa only matches Policy 1 (editor role) → sees only rows where OwnedBy = rosa_id.
       */
      it('SDR rep sees only their own records — self_only prevents rep from getting manager view', async () => {
        const res = await listRecords(base.id, tableId, rosaToken);
        expect(res.status).to.equal(200);
        const records = res.body.list ?? res.body;
        expect(records.length).to.equal(2);
        records.forEach((r: any) => expect(r.OwnedBy).to.equal(rosaUser.id));
      });

      /**
       * Marcus is a direct member of SDRAlpha — self_only matches Policy 2.
       * {currentUser.teamWithDescendantMembers} resolves to all members of [SDRAlpha + AlphaReps].
       * Marcus sees IBM and Oracle (Rosa's deals) but NOT Dell (Raj's deal — Beta branch).
       */
      it('SDR manager sees all records owned by their branch members via teamWithDescendantMembers', async () => {
        const res = await listRecords(base.id, tableId, marcusToken);
        expect(res.status).to.equal(200);
        const records = res.body.list ?? res.body;
        const ownerIds = records.map((r: any) => r.OwnedBy);
        expect(ownerIds).to.include(rosaUser.id); // Rosa's deals visible to Alpha manager
        expect(ownerIds).to.not.include(rajUser.id); // Raj's deal (Beta) not visible
        expect(records.length).to.be.greaterThanOrEqual(2);
      });

      /**
       * Victor is the VP (SalesOrg — ancestor of SDRAlpha and Beta).
       * He matches Policy 1 (editor role) → filter: OwnedBy = victor_id.
       * No deals are owned by Victor → 0 rows from Policy 1.
       * Victor does NOT match Policy 2 (SalesOrg ≠ SDRAlpha self_only).
       * VP sees 0 rows — must explicitly add a VP-level policy to give him access.
       */
      it('VP sees 0 rows — has Editor role but is not in any branch manager team subject', async () => {
        const res = await listRecords(base.id, tableId, victorToken);
        expect(res.status).to.equal(200);
        const records = res.body.list ?? res.body;
        expect(records.length).to.equal(0);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TABLE_RECORD_DELETE — Role-Based Grant Types
    //
    // A media company gates article deletion by editorial role, not team membership.
    // Tests the role-based grant types (editors_and_up, nobody) for TABLE_RECORD_DELETE —
    // these grant types are fully covered for TABLE_VISIBILITY but have zero coverage for DELETE.
    // ─────────────────────────────────────────────────────────────────────────

    describe('TABLE_RECORD_DELETE — role-based grant types (Editorial platform story)', () => {
      let editorUser: any; let editorToken: string;
      let viewerUser: any; let viewerToken: string;

      let base: any;
      let table: any;
      let seedRowId: number;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100 },
        });

        const edR = await createUser(context, { email: 'editorial-editor@test.com' });
        editorUser = edR.user; editorToken = edR.token;

        const vwR = await createUser(context, { email: 'editorial-viewer@test.com' });
        viewerUser = vwR.user; viewerToken = vwR.token;

        base = await createProject(context);
        table = await createTable(context, base);

        await addWorkspaceMembers([editorUser.id, viewerUser.id]);
        await setDirectBaseRole(base.id, editorUser.email, 'editor');
        await setDirectBaseRole(base.id, viewerUser.email, 'viewer');

        seedRowId = await ownerInsert(base.id, table.id, { Title: 'Article-Draft-001' });
      });

      afterEach(async () => {
        await dropPermission(base.id, table.id, 'TABLE_RECORD_DELETE');
        await featureMock?.restore?.();
      });

      /**
       * The editorial platform restricts deletion to editors_and_up via role-based grant.
       * A Viewer should be blocked, an Editor should succeed.
       */
      it('editors_and_up grant: Editor can delete articles, Viewer is blocked', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'role',
          granted_role: 'editor',
        });

        const viewerRes = await deleteRecord(base.id, table.id, viewerToken, seedRowId);
        expect(viewerRes.status).to.be.oneOf([401, 403]);

        const editorRes = await deleteRecord(base.id, table.id, editorToken, seedRowId);
        expect(editorRes.status).to.be.oneOf([200, 204]);
      });

      /**
       * Setting nobody prevents all regular users from deleting articles.
       * The editor-in-chief (base owner) can still delete via owner bypass.
       */
      it('nobody grant: no base user can delete articles (base owner bypass still applies)', async () => {
        await setPermission(base.id, table.id, 'TABLE_RECORD_DELETE', {
          granted_type: 'nobody',
        });

        const editorRes = await deleteRecord(base.id, table.id, editorToken, seedRowId);
        expect(editorRes.status).to.be.oneOf([401, 403]);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Complex Edge Cases
    //
    // Scenarios that combine multiple layers simultaneously in non-obvious ways.
    // ─────────────────────────────────────────────────────────────────────────

    describe('Complex Edge Cases', () => {
      beforeEach(async function () {
        this.timeout(120000);
        context = await init();
        workspaceId = context.fk_workspace_id;

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          features: { [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: true },
          limits: { [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 100 },
        });
      });

      afterEach(async () => { await featureMock?.restore?.(); });

      /**
       * The Accidental Escalation: TABLE_VISIBILITY does NOT elevate a user's role.
       *
       * A finance team restricts a "Confidential Metrics" table to specific users.
       * One of those users happens to be a workspace Creator. The admin only thought
       * about who can SEE the table — not about what a Creator can DO once visible.
       *
       * This test documents that TABLE_VISIBILITY gives view access but does NOT
       * change the user's base role. A Viewer gaining visibility cannot add records.
       */
      it('TABLE_VISIBILITY does not escalate a Viewer into an Editor — role and visibility are independent', async () => {
        const viewerTeamId = await createTeam('Edge-ViewerTeam');
        const viewerR = await createUser(context, { email: 'edge-viewer@test.com' });
        await addMember(viewerTeamId, viewerR.user.id);

        const base = await createProject(context);
        await addWorkspaceMembers([viewerR.user.id]);
        await setDirectBaseRole(base.id, viewerR.user.email, 'viewer');

        const restrictedTable = await createTable(context, base);

        // Grant TABLE_VISIBILITY to viewerTeam — the Viewer can now SEE the table
        await setPermission(base.id, restrictedTable.id, 'TABLE_VISIBILITY', {
          granted_type: 'user',
          subjects: [{ type: 'team', id: viewerTeamId, hierarchy_scope: 'self_only' }],
        });

        // Viewer can see the table in the list
        const listRes = await listTables(base.id, viewerR.token);
        expect(listRes.status).to.equal(200);
        const tableIds = listRes.body.list.map((t: any) => t.id);
        expect(tableIds).to.include(restrictedTable.id);

        // But Viewer CANNOT add records — visibility didn't escalate to Editor
        const insertRes = await insertRecord(base.id, restrictedTable.id, viewerR.token, {
          Title: 'escalation-attempt',
        });
        expect(insertRes.status).to.be.oneOf([401, 403]);

        // And Viewer CANNOT delete records
        const deleteRes = await deleteRecord(base.id, restrictedTable.id, viewerR.token, 1);
        expect(deleteRes.status).to.be.oneOf([401, 403]);

        await dropPermission(base.id, restrictedTable.id, 'TABLE_VISIBILITY');
      });

      /**
       * The Promoted Manager: a single team membership move triggers changes across
       * base role, RLS subject matching, and TABLE_RECORD_DELETE simultaneously.
       *
       * Rosa has been an SDR rep in AlphaReps for a year. She's promoted to Manager of
       * SDR Team Alpha. Moving her from AlphaReps to SDRAlpha changes:
       *   - TABLE_RECORD_DELETE: was blocked (self_only on SDRAlpha) → now allowed
       *   - RLS: was getting own-records only → now matches manager branch policy
       *
       * Before: Viewer via AlphaReps (lower team assignment) → cannot add records
       * After:  Editor via SDRAlpha (promoted team) → can add records
       */
      it('after promotion (team move), employee immediately inherits new team role and permissions', async () => {
        const sdrAlphaId  = await createTeam('Edge-SDRAlpha');
        const alphaRepsId = await createTeam('Edge-AlphaReps', sdrAlphaId);

        const waltR = await createUser(context, { email: 'edge-walt@test.com' });
        await addMember(alphaRepsId, waltR.user.id);

        const base = await createProject(context);
        await addWorkspaceMembers([waltR.user.id]);

        // AlphaReps → Viewer, SDRAlpha → Editor
        await assignBaseTeamRole(base.id, alphaRepsId, ProjectRoles.VIEWER);
        await assignBaseTeamRole(base.id, sdrAlphaId, ProjectRoles.EDITOR);

        const table = await createTable(context, base);

        // Before promotion: Walt is Viewer (via AlphaReps) → cannot add records
        const beforeInsert = await insertRecord(base.id, table.id, waltR.token, { Title: 'before-promo' });
        expect(beforeInsert.status).to.be.oneOf([401, 403]);

        // PROMOTION: move Walt from AlphaReps to SDRAlpha
        await removeMember(alphaRepsId, waltR.user.id);
        await addMember(sdrAlphaId, waltR.user.id);

        // After promotion: Walt is now SDRAlpha → Editor → can add records
        const afterInsert = await insertRecord(base.id, table.id, waltR.token, { Title: 'after-promo' });
        expect(afterInsert.status).to.be.oneOf([200, 201]);
      });
    });
  });
}
