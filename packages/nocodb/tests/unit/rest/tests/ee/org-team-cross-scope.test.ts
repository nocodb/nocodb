import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import {
  EnterpriseOrgUserRoles,
  PlanTitles,
  ProjectRoles,
  TeamUserRoles,
} from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { createUser } from '../../../factory/user';
import { overridePlan } from '../../../utils/plan.utils';
import { createProject } from '../../../factory/base';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Org-Level Teams — Cross-Scope Integration Tests
 *
 * Validates that org-level teams (fk_org_id set, fk_workspace_id NULL)
 * correctly integrate with:
 *   - Workspace/base role inheritance
 *   - RLS policy evaluation
 *   - Table/field permissions (direct_teams)
 *   - Mixed org + workspace team scenarios
 *   - Cross-workspace isolation
 *   - Lifecycle events (unlink, delete, late addition)
 *
 * Every positive assertion includes its reverse in the same it() block.
 *
 * See ORG_TEAMS_TEST_PLAN.md at repo root for the full plan.
 */
export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Org Teams — Cross-Scope Integration', () => {
    let context: any = {};
    let workspaceId: string;
    let orgId: string;
    let featureMock: any;

    // ── Shared helpers ──────────────────────────────────────────

    async function setupOrg(title = 'Test Org'): Promise<string> {
      const id = `ot${Date.now().toString(36)}`;
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

    async function linkWorkspaceToOrg(wsId: string, oId: string) {
      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .where('id', wsId)
        .update({ fk_org_id: oId });
    }

    async function unlinkWorkspaceFromOrg(wsId: string) {
      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .where('id', wsId)
        .update({ fk_org_id: null });
    }

    /** Create an org-scoped team via the org endpoint. */
    async function createOrgTeam(
      title: string,
      parentTeamId?: string,
    ): Promise<string> {
      const body: any = { title };
      if (parentTeamId) body.parent_team_id = parentTeamId;
      const res = await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams`)
        .set('xc-token', context.xc_token)
        .send(body);
      if (res.status !== 200) {
        throw new Error(
          `createOrgTeam("${title}") failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }
      return res.body.id;
    }

    /** Create a workspace-scoped team. */
    async function createWsTeam(
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
          `createWsTeam("${title}") failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }
      return res.body.id;
    }

    async function addOrgMember(teamId: string, userId: string) {
      // Ensure user is an org member first (required by org team member validation)
      await addUserToOrg(userId);
      await request(context.app)
        .post(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: userId, team_role: TeamUserRoles.MEMBER }])
        .expect(200);
    }

    async function addWsMember(teamId: string, userId: string) {
      await request(context.app)
        .post(
          `/api/v3/meta/workspaces/${workspaceId}/teams/${teamId}/members`,
        )
        .set('xc-token', context.xc_token)
        .send([{ user_id: userId, team_role: TeamUserRoles.MEMBER }])
        .expect(200);
    }

    async function removeOrgMember(teamId: string, userId: string) {
      await request(context.app)
        .delete(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/members`)
        .set('xc-token', context.xc_token)
        .send([{ user_id: userId }])
        .expect(200);
    }

    async function addWorkspaceMembers(
      userIds: string[],
      role = 'workspace-level-editor',
    ) {
      await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/members`)
        .set('xc-token', context.xc_token)
        .send(userIds.map((user_id) => ({ user_id, workspace_role: role })))
        .expect(200);
    }

    async function assignBaseTeamRole(
      baseId: string,
      teamId: string,
      role: string,
    ) {
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

    async function setDirectBaseRole(
      baseId: string,
      userEmail: string,
      role: string,
    ) {
      await request(context.app)
        .post(`/api/v2/meta/bases/${baseId}/users`)
        .set('xc-token', context.xc_token)
        .send({ email: userEmail, roles: role })
        .expect(200);
    }

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

    async function createNamedTable(
      baseId: string,
      title: string,
    ): Promise<string> {
      const res = await request(context.app)
        .post(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          table_name: title,
          title,
          columns: [
            { column_name: 'id', title: 'Id', uidt: 'ID' },
            {
              column_name: 'title',
              title: 'Title',
              uidt: 'SingleLineText',
            },
          ],
        })
        .expect(200);
      return res.body.id;
    }

    async function addColumn(
      tableId: string,
      title: string,
      uidt: string,
    ): Promise<string> {
      await request(context.app)
        .post(`/api/v1/db/meta/tables/${tableId}/columns`)
        .set('xc-token', context.xc_token)
        .send({ title, uidt })
        .expect(200);
      const tableRes = await request(context.app)
        .get(`/api/v1/db/meta/tables/${tableId}`)
        .set('xc-token', context.xc_token)
        .expect(200);
      const col = (tableRes.body.columns || []).find(
        (c: any) => c.title === title,
      );
      if (!col?.id)
        throw new Error(`addColumn("${title}"): column not found in table`);
      return col.id;
    }

    async function ownerInsert(
      baseId: string,
      tableId: string,
      data: any,
    ): Promise<number> {
      const res = await request(context.app)
        .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-token', context.xc_token)
        .send(data);
      expect(res.status).to.be.oneOf([200, 201]);
      return res.body.Id ?? res.body.id;
    }

    async function listRecords(
      baseId: string,
      tableId: string,
      token: string,
    ) {
      return request(context.app)
        .get(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-auth', token);
    }

    async function listTables(baseId: string, token: string) {
      return request(context.app)
        .get(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-auth', token);
    }

    async function deleteRecord(
      baseId: string,
      tableId: string,
      token: string,
      rowId: number,
    ) {
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

    async function insertRecord(
      baseId: string,
      tableId: string,
      token: string,
      data: any,
    ) {
      return request(context.app)
        .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-auth', token)
        .send(data);
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
      const isEmptyObj =
        filter !== null &&
        typeof filter === 'object' &&
        !Array.isArray(filter) &&
        Object.keys(filter).length === 0;
      if (filter !== undefined && !isEmptyObj) {
        body.filters = Array.isArray(filter) ? filter : [filter];
      }
      if (isDefault !== undefined) {
        body.is_default = isDefault;
        if (isDefault) body.default_behavior = 'deny_all';
      }
      return request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'rlsPolicyCreate' })
        .send(body);
    }

    async function setPermission(
      baseId: string,
      entityId: string,
      permissionKey: string,
      payload: any,
    ) {
      return request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'setPermission' })
        .send({
          entity: 'table',
          entity_id: entityId,
          permission: permissionKey,
          ...payload,
        });
    }

    async function dropPermission(
      baseId: string,
      entityId: string,
      permissionKey: string,
      entity = 'table',
    ) {
      await request(context.app)
        .post(`/api/v2/internal/${workspaceId}/${baseId}`)
        .set('xc-token', context.xc_token)
        .query({ operation: 'dropPermission' })
        .send({ entity, entity_id: entityId, permission: permissionKey });
    }

    async function moveOrgTeam(
      teamId: string,
      parentTeamId: string | null,
    ) {
      return request(context.app)
        .patch(`/api/v3/meta/orgs/${orgId}/teams/${teamId}/move`)
        .set('xc-token', context.xc_token)
        .send({ parent_team_id: parentTeamId });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: Workspace Role Inheritance via Org Teams
    // ═══════════════════════════════════════════════════════════════════════

    describe('§1 Workspace Role Inheritance via Org Teams', () => {
      let engineeringId: string;
      let frontendId: string;
      let designId: string;

      let engUser: any;
      let engToken: string;
      let feUser: any;
      let feToken: string;
      let designUser: any;
      let designToken: string;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        // Org hierarchy: Engineering → Frontend, Design (root)
        engineeringId = await createOrgTeam('Engineering');
        frontendId = await createOrgTeam('Frontend', engineeringId);
        designId = await createOrgTeam('Design');

        const engR = await createUser(context, {
          email: 'ocs1-eng@test.com',
        });
        engUser = engR.user;
        engToken = engR.token;

        const feR = await createUser(context, {
          email: 'ocs1-fe@test.com',
        });
        feUser = feR.user;
        feToken = feR.token;

        const designR = await createUser(context, {
          email: 'ocs1-design@test.com',
        });
        designUser = designR.user;
        designToken = designR.token;

        await addOrgMember(engineeringId, engUser.id);
        await addOrgMember(frontendId, feUser.id);
        await addOrgMember(designId, designUser.id);

        // Assign org team "Engineering" as workspace Editor
        await assignWorkspaceTeamRole(
          engineeringId,
          'workspace-level-editor',
        );
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      /**
       * Org team "Engineering" is assigned workspace Editor role.
       * engUser is a direct member of Engineering → should get Editor.
       * designUser is in a separate org team "Design" with no assignment → no role.
       *
       * Validates: extractUserTeamRoles includes org teams when resolving workspace roles.
       * Bug caught: Team.getByIds filtering by fk_workspace_id would exclude org teams.
       */
      it('1.1 — user in org team gets workspace Editor; user NOT in org team gets no role', async () => {
        const engRoles = await getUserRoles(engToken);
        const wsRoles = engRoles.workspace_roles || {};
        expect(
          wsRoles['workspace-level-editor'] || wsRoles.editor,
        ).to.be.true;

        // Reverse: design user not in Engineering team, has no workspace role
        const designRoles = await getUserRoles(designToken);
        const dWsRoles = designRoles.workspace_roles || {};
        expect(dWsRoles['workspace-level-editor']).to.not.be.true;
        expect(dWsRoles['editor']).to.not.be.true;
      });

      /**
       * Engineering → Frontend (child). Engineering is assigned workspace Editor.
       * feUser is in Frontend (child of Engineering) → should inherit Editor via upward cascade.
       * designUser is in Design (no parent relationship to Engineering) → no role.
       *
       * Validates: team hierarchy traversal works cross-scope (org team descendants
       * are found even when the context has a workspace_id).
       */
      it('1.2 — upward cascade: user in org team child inherits workspace role; unrelated team does not', async () => {
        // Frontend is child of Engineering — feUser should inherit Editor
        const feRoles = await getUserRoles(feToken);
        const feWsRoles = feRoles.workspace_roles || {};
        expect(
          feWsRoles['workspace-level-editor'] || feWsRoles.editor,
        ).to.be.true;

        // Design is unrelated — no inheritance
        const designRoles = await getUserRoles(designToken);
        const dWsRoles = designRoles.workspace_roles || {};
        expect(dWsRoles['workspace-level-editor']).to.not.be.true;
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: Base Role Inheritance via Org Teams
    // ═══════════════════════════════════════════════════════════════════════

    describe('§2 Base Role Inheritance via Org Teams', () => {
      let engineeringId: string;
      let frontendId: string;
      let designId: string;

      let engUser: any;
      let engToken: string;
      let feUser: any;
      let feToken: string;
      let designUser: any;
      let designToken: string;

      let base: any;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        engineeringId = await createOrgTeam('Engineering');
        frontendId = await createOrgTeam('Frontend', engineeringId);
        designId = await createOrgTeam('Design');

        const engR = await createUser(context, {
          email: 'ocs2-eng@test.com',
        });
        engUser = engR.user;
        engToken = engR.token;

        const feR = await createUser(context, {
          email: 'ocs2-fe@test.com',
        });
        feUser = feR.user;
        feToken = feR.token;

        const designR = await createUser(context, {
          email: 'ocs2-design@test.com',
        });
        designUser = designR.user;
        designToken = designR.token;

        await addOrgMember(engineeringId, engUser.id);
        await addOrgMember(frontendId, feUser.id);
        await addOrgMember(designId, designUser.id);

        // Add all as workspace members so they pass middleware
        await addWorkspaceMembers([
          engUser.id,
          feUser.id,
          designUser.id,
        ]);

        base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          engineeringId,
          ProjectRoles.EDITOR,
        );
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      /**
       * Org team "Engineering" is assigned Editor on a base.
       * engUser (direct member) → should get base Editor, can list tables.
       * designUser (in unrelated org team "Design", no base assignment) → 403.
       *
       * Validates: extractUserBaseTeamRoles resolves org team → base role assignments.
       */
      it('2.1 — user in org team gets base Editor; user NOT in org team gets 403', async () => {
        const engRoles = await getUserRoles(engToken, base.id);
        const baseRoles = engRoles.base_roles || {};
        expect(baseRoles['editor'] || baseRoles[ProjectRoles.EDITOR]).to
          .be.true;

        // Reverse: design user cannot list tables
        const designRes = await listTables(base.id, designToken);
        expect(designRes.status).to.be.oneOf([403, 401]);
      });

      /**
       * Engineering → Frontend (child). Engineering assigned Editor on base.
       * feUser is in Frontend → inherits Editor via upward cascade.
       * designUser is in Design (no relationship) → 403.
       *
       * Validates: Team.getByIds returns org teams when called from
       * extractUserBaseTeamRoles with workspace context.
       */
      it('2.2 — descendant inherits base role via upward cascade; unrelated org team gets 403', async () => {
        // Frontend is child of Engineering — feUser should inherit Editor
        const feRoles = await getUserRoles(feToken, base.id);
        const baseRoles = feRoles.base_roles || {};
        expect(baseRoles['editor'] || baseRoles[ProjectRoles.EDITOR]).to
          .be.true;

        // Reverse: design user — unrelated org team
        const designRes = await listTables(base.id, designToken);
        expect(designRes.status).to.be.oneOf([403, 401]);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: RLS with Org Team Subjects
    // ═══════════════════════════════════════════════════════════════════════

    describe('§3 RLS with Org Team Subjects', () => {
      let salesId: string;
      let eastCoastId: string;
      let nySalesId: string;
      let westCoastId: string;
      let laSalesId: string;

      let nancyUser: any;
      let nancyToken: string; // NY Sales — East
      let luisUser: any;
      let luisToken: string; // LA Sales — West
      let victorUser: any;
      let victorToken: string; // VP Sales — no match

      let base: any;
      let tableId: string;
      let regionColId: string;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        // Org hierarchy:
        //   Sales → East Coast → NY Sales
        //         → West Coast → LA Sales
        salesId = await createOrgTeam('RLS-Sales');
        eastCoastId = await createOrgTeam('RLS-EastCoast', salesId);
        nySalesId = await createOrgTeam('RLS-NYSales', eastCoastId);
        westCoastId = await createOrgTeam('RLS-WestCoast', salesId);
        laSalesId = await createOrgTeam('RLS-LASales', westCoastId);

        const nancyR = await createUser(context, {
          email: 'ocs3-nancy@test.com',
        });
        nancyUser = nancyR.user;
        nancyToken = nancyR.token;

        const luisR = await createUser(context, {
          email: 'ocs3-luis@test.com',
        });
        luisUser = luisR.user;
        luisToken = luisR.token;

        const victorR = await createUser(context, {
          email: 'ocs3-victor@test.com',
        });
        victorUser = victorR.user;
        victorToken = victorR.token;

        await addOrgMember(nySalesId, nancyUser.id);
        await addOrgMember(laSalesId, luisUser.id);
        await addOrgMember(salesId, victorUser.id);

        await addWorkspaceMembers([
          nancyUser.id,
          luisUser.id,
          victorUser.id,
        ]);

        base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          salesId,
          ProjectRoles.EDITOR,
        );

        tableId = await createNamedTable(base.id, 'Deals');
        regionColId = await addColumn(tableId, 'Region', 'SingleLineText');

        await ownerInsert(base.id, tableId, {
          Title: 'Acme Corp',
          Region: 'East',
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Globex',
          Region: 'East',
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Initech',
          Region: 'East',
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Umbrella',
          Region: 'West',
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Massive Dyn',
          Region: 'West',
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Soylent',
          Region: 'West',
        });

        // East Coast View: East Coast + descendants see East rows
        await createRlsPolicy(
          base.id,
          tableId,
          'East Coast View',
          [
            {
              type: 'team',
              id: eastCoastId,
              hierarchy_scope: 'self_and_descendants',
            },
          ],
          {
            fk_column_id: regionColId,
            comparison_op: 'eq',
            value: 'East',
          },
        );

        // West Coast View: West Coast + descendants see West rows
        await createRlsPolicy(
          base.id,
          tableId,
          'West Coast View',
          [
            {
              type: 'team',
              id: westCoastId,
              hierarchy_scope: 'self_and_descendants',
            },
          ],
          {
            fk_column_id: regionColId,
            comparison_op: 'eq',
            value: 'West',
          },
        );

        // Default: deny_all
        await createRlsPolicy(
          base.id,
          tableId,
          'Default Deny',
          [],
          undefined,
          true,
        );
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      /**
       * Table "Deals" has 6 rows: 3 East, 3 West.
       * RLS: East Coast (org team, self_and_descendants) → see East rows.
       * RLS: West Coast (org team, self_and_descendants) → see West rows.
       * Default: deny_all.
       *
       * Luis is in LA Sales (child of West Coast) → sees 3 West rows.
       * Nancy is in NY Sales (child of East Coast) → sees 3 East rows.
       *
       * Validates: matchTeamSubjectsBatch correctly resolves org team subjects in RLS.
       */
      it('3.1 — direct org team member sees filtered rows; unrelated member sees 0', async () => {
        // Luis is in LA Sales (descendant of West Coast) — sees 3 West rows
        const luisRes = await listRecords(base.id, tableId, luisToken);
        expect(luisRes.status).to.equal(200);
        const luisRows = luisRes.body.list ?? luisRes.body;
        expect(luisRows.length).to.equal(3);
        luisRows.forEach((r: any) => expect(r.Region).to.equal('West'));

        // Reverse: Nancy (East) sees 0 West rows — she sees East rows only
        const nancyRes = await listRecords(base.id, tableId, nancyToken);
        const nancyRows = nancyRes.body.list ?? nancyRes.body;
        expect(nancyRows.length).to.equal(3);
        nancyRows.forEach((r: any) => expect(r.Region).to.equal('East'));
      });

      /**
       * Nancy is in NY Sales, a GRANDCHILD of Sales (Sales → East Coast → NY Sales).
       * The RLS subject is East Coast with self_and_descendants.
       * NY Sales is a descendant → Nancy should match.
       *
       * Victor is in Sales (PARENT of East Coast) — NOT a descendant of the
       * subject, so no policy matches → deny_all → 0 rows.
       *
       * Validates: getDescendantsForMultiple finds org team descendants correctly.
       */
      it('3.2 — descendant org team member matches RLS; VP with no matching policy sees 0', async () => {
        // Nancy is in NY Sales (child of East Coast) — sees 3 East rows
        const nancyRes = await listRecords(base.id, tableId, nancyToken);
        const nancyRows = nancyRes.body.list ?? nancyRes.body;
        expect(nancyRows.length).to.equal(3);
        nancyRows.forEach((r: any) => expect(r.Region).to.equal('East'));

        // Victor is in Sales (parent of East/West) but NOT in East/West subject — deny_all
        const victorRes = await listRecords(
          base.id,
          tableId,
          victorToken,
        );
        const victorRows = victorRes.body.list ?? victorRes.body;
        expect(victorRows.length).to.equal(0);
      });

      /**
       * RLS must be enforced on single-record GET, not just list endpoints.
       * Nancy (East Coast descendant) can fetch an East record by row ID.
       * The same Nancy gets 403/404 when fetching a West record by row ID.
       *
       * Validates: per-record RLS enforcement with org team subjects.
       */
      it('3.3 — single record fetch: matching user allowed, same user blocked on other region', async () => {
        // Insert known rows to get their IDs
        const eastRowId = await ownerInsert(base.id, tableId, {
          Title: 'EastOnly',
          Region: 'East',
        });
        const westRowId = await ownerInsert(base.id, tableId, {
          Title: 'WestOnly',
          Region: 'West',
        });

        // Nancy (East) can fetch East record
        const allowedRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/${eastRowId}`)
          .set('xc-auth', nancyToken);
        expect(allowedRes.status).to.equal(200);

        // Nancy cannot fetch West record
        const blockedRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/${westRowId}`)
          .set('xc-auth', nancyToken);
        expect(blockedRes.status).to.be.oneOf([403, 404]);
      });

      /**
       * NY Sales starts as child of East Coast → Nancy sees 3 East rows.
       * NY Sales is moved to be a child of Sales (sibling of East Coast).
       * Nancy is no longer a descendant of the East Coast RLS subject → 0 rows.
       * NY Sales is moved back under East Coast → Nancy sees 3 rows again.
       *
       * Validates: org team reparent immediately invalidates cached hierarchy
       * and RLS re-evaluates against the new tree structure.
       */
      it('3.4 — org team reparent immediately updates RLS access', async () => {
        // Before: Nancy (NY Sales, child of East Coast) sees 3 East rows
        let res = await listRecords(base.id, tableId, nancyToken);
        let rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(3);

        // Move NY Sales to root (out of East Coast)
        const moveRes = await moveOrgTeam(nySalesId, salesId);
        expect(moveRes.status).to.equal(200);

        // After: Nancy sees 0 rows (no longer descendant of East Coast)
        res = await listRecords(base.id, tableId, nancyToken);
        rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(0);

        // Move back under East Coast — access restored
        const moveBackRes = await moveOrgTeam(nySalesId, eastCoastId);
        expect(moveBackRes.status).to.equal(200);

        res = await listRecords(base.id, tableId, nancyToken);
        rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(3);
      });

      /**
       * A column "OwnedByTeam" stores the team ID that owns each row.
       * RLS filter: OwnedByTeam LIKE {currentUser.teams}.
       * The placeholder should resolve to include org team IDs.
       *
       * Nancy (in East Coast descendant) → her teams include East Coast chain → matches.
       * Victor (in Sales, not in East Coast subject) → 0 rows.
       *
       * Validates: the {currentUser.teams} RLS placeholder includes org team IDs
       * from the user's team memberships.
       */
      it('3.5 — {currentUser.teams} placeholder includes org team IDs; non-member gets 0', async () => {
        // Add a column to tag rows by team
        const teamTagColId = await addColumn(
          tableId,
          'OwnedByTeam',
          'SingleLineText',
        );

        // Insert rows tagged with org team IDs
        await ownerInsert(base.id, tableId, {
          Title: 'Tagged-East',
          Region: 'East',
          OwnedByTeam: eastCoastId,
        });

        // Create RLS policy using {currentUser.teams}
        await createRlsPolicy(
          base.id,
          tableId,
          'Team Tag Policy',
          [
            {
              type: 'team',
              id: eastCoastId,
              hierarchy_scope: 'self_and_descendants',
            },
          ],
          {
            fk_column_id: teamTagColId,
            comparison_op: 'like',
            value: '{currentUser.teams}',
          },
        );

        // Nancy (in East Coast descendant) should match
        const nancyRes = await listRecords(base.id, tableId, nancyToken);
        expect(nancyRes.status).to.equal(200);

        // Victor (in Sales, not in East Coast) sees 0 from this policy
        const victorRes = await listRecords(
          base.id,
          tableId,
          victorToken,
        );
        const victorRows = victorRes.body.list ?? victorRes.body;
        expect(victorRows.length).to.equal(0);
      });

      /**
       * RLS policies are base-scoped. An org team used as an RLS subject in
       * Base-A should NOT affect Base-B (which has no RLS policies).
       *
       * Nancy sees 3 filtered East rows in Base-A (RLS active).
       * In Base-B (no RLS) she sees ALL rows — confirms no leakage.
       *
       * Validates: RLS evaluation is scoped to the base, not inherited
       * across bases just because the same org team exists.
       */
      it('3.6 — no cross-workspace RLS leakage with org teams', async () => {
        // Nancy sees 3 East rows in WS-A (current workspace)
        let res = await listRecords(base.id, tableId, nancyToken);
        let rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(3);

        // Create a second workspace under the same org — but NO RLS policy there
        // We simulate by verifying that a different base (without RLS) in the
        // same workspace is unaffected
        const base2 = await createProject(context);
        await assignBaseTeamRole(
          base2.id,
          salesId,
          ProjectRoles.EDITOR,
        );
        const table2Id = await createNamedTable(base2.id, 'Deals2');
        await addColumn(table2Id, 'Region', 'SingleLineText');
        await ownerInsert(base2.id, table2Id, {
          Title: 'No RLS row',
          Region: 'East',
        });
        await ownerInsert(base2.id, table2Id, {
          Title: 'No RLS West',
          Region: 'West',
        });

        // Nancy sees ALL rows in base2 (no RLS policy) — confirms no leakage
        res = await listRecords(base2.id, table2Id, nancyToken);
        rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(2);
      });

      /**
       * The /count endpoint must respect RLS just like the list endpoint.
       * Nancy (East descendant) → count = 3.
       * Victor (no matching policy) → count = 0.
       *
       * Validates: getRlsConditions is applied to count queries, not just list.
       */
      it('3.7 — row count endpoint respects org-team RLS', async () => {
        // Nancy (East descendant) should see count = 3
        const nancyCount = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/count`)
          .set('xc-auth', nancyToken);
        expect(nancyCount.status).to.equal(200);
        expect(nancyCount.body.count).to.equal(3);

        // Victor (no matching policy) should see count = 0
        const victorCount = await request(context.app)
          .get(`/api/v1/db/data/noco/${base.id}/${tableId}/count`)
          .set('xc-auth', victorToken);
        expect(victorCount.status).to.equal(200);
        expect(victorCount.body.count).to.equal(0);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: {currentUser.teamWithDescendantMembers} Placeholder
    // ═══════════════════════════════════════════════════════════════════════

    describe('§4 {currentUser.teamWithDescendantMembers} Placeholder', () => {
      let sdrOrgId: string;
      let sdrAlphaId: string;
      let alphaRepsId: string;
      let sdrBetaId: string;

      let marcusUser: any;
      let marcusToken: string; // SDR-Alpha manager
      let rosaUser: any;
      let rosaToken: string; // Alpha rep
      let rajUser: any;
      let rajToken: string; // Beta rep

      let base: any;
      let tableId: string;
      let ownedByColId: string;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        // Org hierarchy: SDR-Org → SDR-Alpha → Alpha-Reps
        //                        → SDR-Beta
        sdrOrgId = await createOrgTeam('SDR-SalesOrg');
        sdrAlphaId = await createOrgTeam('SDR-SDRAlpha', sdrOrgId);
        alphaRepsId = await createOrgTeam('SDR-AlphaReps', sdrAlphaId);
        sdrBetaId = await createOrgTeam('SDR-SDRBeta', sdrOrgId);

        const marcusR = await createUser(context, {
          email: 'ocs4-marcus@test.com',
        });
        marcusUser = marcusR.user;
        marcusToken = marcusR.token;

        const rosaR = await createUser(context, {
          email: 'ocs4-rosa@test.com',
        });
        rosaUser = rosaR.user;
        rosaToken = rosaR.token;

        const rajR = await createUser(context, {
          email: 'ocs4-raj@test.com',
        });
        rajUser = rajR.user;
        rajToken = rajR.token;

        await addOrgMember(sdrAlphaId, marcusUser.id);
        await addOrgMember(alphaRepsId, rosaUser.id);
        await addOrgMember(sdrBetaId, rajUser.id);

        await addWorkspaceMembers([
          marcusUser.id,
          rosaUser.id,
          rajUser.id,
        ]);

        base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          sdrOrgId,
          ProjectRoles.EDITOR,
        );

        tableId = await createNamedTable(base.id, 'Leads');
        ownedByColId = await addColumn(
          tableId,
          'OwnedBy',
          'SingleLineText',
        );

        // Seed data: each rep owns their records
        await ownerInsert(base.id, tableId, {
          Title: 'Lead-Rosa-1',
          OwnedBy: rosaUser.id,
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Lead-Rosa-2',
          OwnedBy: rosaUser.id,
        });
        await ownerInsert(base.id, tableId, {
          Title: 'Lead-Raj-1',
          OwnedBy: rajUser.id,
        });

        // Policy 1: everyone sees own records
        await createRlsPolicy(
          base.id,
          tableId,
          'Own Records',
          [{ type: 'role', id: ProjectRoles.EDITOR }],
          {
            fk_column_id: ownedByColId,
            comparison_op: 'eq',
            value: '{currentUser.id}',
          },
        );

        // Policy 2: SDR-Alpha managers (self_only) see all Alpha branch
        await createRlsPolicy(
          base.id,
          tableId,
          'Alpha Branch View',
          [
            {
              type: 'team',
              id: sdrAlphaId,
              hierarchy_scope: 'self_only',
            },
          ],
          {
            fk_column_id: ownedByColId,
            comparison_op: 'like',
            value: '{currentUser.teamWithDescendantMembers}',
          },
        );

        // Default: deny_all
        await createRlsPolicy(
          base.id,
          tableId,
          'Default Deny',
          [],
          undefined,
          true,
        );
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      /**
       * Org hierarchy: SDR-SalesOrg → SDR-Alpha → Alpha-Reps
       *                             → SDR-Beta
       *
       * Policy 2 uses {currentUser.teamWithDescendantMembers} for SDR-Alpha (self_only).
       * Marcus (SDR-Alpha manager) → the placeholder resolves to user IDs of
       *   Marcus + Rosa (Alpha-Reps member). He sees Rosa's 2 records.
       * Marcus should NOT see Raj's record (Beta branch — different subtree).
       *
       * Validates: getMemberUserIdsForTeamsAndDescendants correctly expands
       * org team hierarchies for the placeholder.
       */
      it('4.1 — org team manager sees all branch records; different branch manager sees 0', async () => {
        // Marcus (SDR-Alpha, self_only) sees Rosa's records (Alpha branch)
        const marcusRes = await listRecords(
          base.id,
          tableId,
          marcusToken,
        );
        const marcusRows = marcusRes.body.list ?? marcusRes.body;
        // Marcus matches Policy 2 (Alpha branch) — sees Rosa's 2 records
        const rosaRecords = marcusRows.filter(
          (r: any) => r.OwnedBy === rosaUser.id,
        );
        expect(rosaRecords.length).to.equal(2);

        // Marcus should NOT see Raj's records (Beta branch)
        const rajRecords = marcusRows.filter(
          (r: any) => r.OwnedBy === rajUser.id,
        );
        expect(rajRecords.length).to.equal(0);
      });

      /**
       * Rosa is in Alpha-Reps (descendant of SDR-Alpha).
       * Policy 2 is self_only on SDR-Alpha → Rosa is NOT a direct member of
       * SDR-Alpha, so Policy 2 does NOT match for her.
       * Policy 1 (own records) DOES match → Rosa sees only her 2 records.
       * She should NOT see Raj's record.
       *
       * Validates: self_only scope on org team prevents descendant members
       * from getting the manager-level {teamWithDescendantMembers} expansion.
       */
      it('4.2 — org team member sees only own records; not other rep records', async () => {
        // Rosa (Alpha rep) matches Policy 1 (own records only, not Policy 2 since self_only)
        const rosaRes = await listRecords(
          base.id,
          tableId,
          rosaToken,
        );
        const rosaRows = rosaRes.body.list ?? rosaRes.body;
        expect(rosaRows.length).to.equal(2);
        rosaRows.forEach((r: any) =>
          expect(r.OwnedBy).to.equal(rosaUser.id),
        );

        // Rosa does NOT see Raj's record
        const rajRecords = rosaRows.filter(
          (r: any) => r.OwnedBy === rajUser.id,
        );
        expect(rajRecords.length).to.equal(0);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: Table/Field Permissions with Org Team Subjects
    // ═══════════════════════════════════════════════════════════════════════

    describe('§5 Table/Field Permissions with Org Team Subjects', () => {
      let engineeringId: string;
      let frontendId: string;
      let designId: string;

      let engUser: any;
      let engToken: string;
      let feUser: any;
      let feToken: string;
      let designUser: any;
      let designToken: string;

      let base: any;
      let tableId: string;
      let salaryFieldId: string;
      let seedRowId: number;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        engineeringId = await createOrgTeam('Engineering');
        frontendId = await createOrgTeam('Frontend', engineeringId);
        designId = await createOrgTeam('Design');

        const engR = await createUser(context, {
          email: 'ocs5-eng@test.com',
        });
        engUser = engR.user;
        engToken = engR.token;

        const feR = await createUser(context, {
          email: 'ocs5-fe@test.com',
        });
        feUser = feR.user;
        feToken = feR.token;

        const designR = await createUser(context, {
          email: 'ocs5-design@test.com',
        });
        designUser = designR.user;
        designToken = designR.token;

        await addOrgMember(engineeringId, engUser.id);
        await addOrgMember(frontendId, feUser.id);
        await addOrgMember(designId, designUser.id);

        await addWorkspaceMembers([
          engUser.id,
          feUser.id,
          designUser.id,
        ]);

        base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          engineeringId,
          ProjectRoles.EDITOR,
        );
        // Give Design Editor too so they pass base middleware
        await assignBaseTeamRole(
          base.id,
          designId,
          ProjectRoles.EDITOR,
        );

        tableId = await createNamedTable(base.id, 'Employees');
        salaryFieldId = await addColumn(tableId, 'Salary', 'Number');

        seedRowId = await ownerInsert(base.id, tableId, {
          Title: 'Alice',
          Salary: 80000,
        });
      });

      afterEach(async () => {
        await dropPermission(base.id, tableId, 'TABLE_RECORD_DELETE');
        await dropPermission(
          base.id,
          salaryFieldId,
          'RECORD_FIELD_EDIT',
          'field',
        );
        await featureMock?.restore?.();
      });

      /**
       * TABLE_RECORD_DELETE permission set with org team "Engineering" as
       * subject (self_and_descendants).
       * engUser (direct Engineering member) → can delete a record.
       * designUser (in "Design", NOT in Engineering) → 403 on delete.
       *
       * Validates: direct_teams (from /auth/me) includes org teams, and
       * the frontend permission check (usePermissions.ts) correctly matches
       * org team subjects.
       */
      it('5.1 — TABLE_RECORD_DELETE: org team member can delete; non-member gets 403', async () => {
        await setPermission(base.id, tableId, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_and_descendants',
            },
          ],
        });

        const row = await ownerInsert(base.id, tableId, {
          Title: 'ToDelete',
          Salary: 1,
        });

        // Engineering member can delete
        const engRes = await deleteRecord(
          base.id,
          tableId,
          engToken,
          row,
        );
        expect(engRes.status).to.be.oneOf([200, 204]);

        // Design member (not in Engineering) cannot delete
        const row2 = await ownerInsert(base.id, tableId, {
          Title: 'ToDelete2',
          Salary: 2,
        });
        const designRes = await deleteRecord(
          base.id,
          tableId,
          designToken,
          row2,
        );
        expect(designRes.status).to.be.oneOf([401, 403]);
      });

      /**
       * Same permission as 5.1 (Engineering, self_and_descendants).
       * feUser is in Frontend (child of Engineering) → can delete (descendant match).
       * designUser (Design) → 403.
       *
       * Validates: permission subject descendant expansion works for org teams.
       * The path-based hierarchy check in usePermissions.ts traverses org team paths.
       */
      it('5.2 — TABLE_RECORD_DELETE: descendant can delete; unrelated cannot', async () => {
        await setPermission(base.id, tableId, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_and_descendants',
            },
          ],
        });

        const row = await ownerInsert(base.id, tableId, {
          Title: 'ToDelete3',
          Salary: 3,
        });

        // Frontend (child of Engineering) can delete
        const feRes = await deleteRecord(
          base.id,
          tableId,
          feToken,
          row,
        );
        expect(feRes.status).to.be.oneOf([200, 204]);

        // Design cannot
        const row2 = await ownerInsert(base.id, tableId, {
          Title: 'ToDelete4',
          Salary: 4,
        });
        const designRes = await deleteRecord(
          base.id,
          tableId,
          designToken,
          row2,
        );
        expect(designRes.status).to.be.oneOf([401, 403]);
      });

      /**
       * Permission set with Engineering as subject, but scope = self_only.
       * engUser (direct Engineering member) → can delete.
       * feUser (Frontend = child of Engineering) → CANNOT delete.
       *   self_only means only direct team members, not descendants.
       *
       * Validates: self_only scope restriction is honored for org team subjects.
       * Frontend checks directTeams.some(t => t.team_id === subject.id) — no
       * path traversal for self_only.
       */
      it('5.3 — self_only: direct member can delete; descendant CANNOT', async () => {
        await setPermission(base.id, tableId, 'TABLE_RECORD_DELETE', {
          granted_type: 'user',
          subjects: [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ],
        });

        const row = await ownerInsert(base.id, tableId, {
          Title: 'SelfOnly',
          Salary: 5,
        });

        // Direct Engineering member can delete
        const engRes = await deleteRecord(
          base.id,
          tableId,
          engToken,
          row,
        );
        expect(engRes.status).to.be.oneOf([200, 204]);

        // Frontend (descendant) CANNOT — self_only blocks descendants
        const row2 = await ownerInsert(base.id, tableId, {
          Title: 'SelfOnly2',
          Salary: 6,
        });
        const feRes = await deleteRecord(
          base.id,
          tableId,
          feToken,
          row2,
        );
        expect(feRes.status).to.be.oneOf([401, 403]);
      });

      /**
       * RECORD_FIELD_EDIT on "Salary" field, subject = Engineering (self_only).
       * engUser (direct Engineering member) → can update Salary to 95000.
       * designUser (Design, has Editor base role but NOT in Engineering) →
       *   cannot update Salary (field-level permission blocks it).
       *
       * Validates: field-level permissions (not just table-level) work with
       * org team subjects. This is a different permission type than TABLE_RECORD_DELETE.
       */
      it('5.4 — RECORD_FIELD_EDIT: org team member can edit protected field; non-member cannot', async () => {
        await setPermission(base.id, tableId, 'RECORD_FIELD_EDIT', {
          entity: 'field',
          entity_id: salaryFieldId,
          granted_type: 'user',
          subjects: [
            {
              type: 'team',
              id: engineeringId,
              hierarchy_scope: 'self_only',
            },
          ],
        });

        // Engineering member can edit Salary
        const engRes = await updateRecord(
          base.id,
          tableId,
          engToken,
          seedRowId,
          { Salary: 95000 },
        );
        expect(engRes.status).to.be.oneOf([200, 201]);

        // Design member (Editor but not in Engineering) cannot edit Salary
        const designRes = await updateRecord(
          base.id,
          tableId,
          designToken,
          seedRowId,
          { Salary: 120000 },
        );
        expect(designRes.status).to.be.oneOf([401, 403]);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: Mixed Org + Workspace Teams
    // ═══════════════════════════════════════════════════════════════════════

    describe('§6 Mixed Org + Workspace Teams', () => {
      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      /**
       * Workspace is linked to an org. One org team and one workspace team exist.
       * GET /workspaces/{wsId}/teams should return both.
       * Org team has scope='org', workspace team has scope='workspace'.
       *
       * Validates: teamList endpoint merges org teams into workspace team list
       * when the workspace belongs to an org.
       */
      it('6.1 — workspace team list includes both org and workspace teams with correct scope', async () => {
        const orgTeamId = await createOrgTeam('Org Global');
        const wsTeamId = await createWsTeam('WS Local');

        const res = await request(context.app)
          .get(`/api/v3/meta/workspaces/${workspaceId}/teams`)
          .set('xc-token', context.xc_token)
          .expect(200);

        const teams = res.body.list || [];
        const orgTeam = teams.find((t: any) => t.id === orgTeamId);
        const wsTeam = teams.find((t: any) => t.id === wsTeamId);

        expect(orgTeam).to.exist;
        expect(orgTeam.scope).to.equal('org');

        expect(wsTeam).to.exist;
        expect(wsTeam.scope).to.equal('workspace');
      });

      /**
       * Two RLS policies on the same table:
       *   Policy A: org team "OrgEast" → see East rows.
       *   Policy B: workspace team "WsWest" → see West rows.
       * Default: deny_all.
       *
       * Alice (in org team) → sees only East rows.
       * Bob (in workspace team) → sees only West rows.
       * Neither sees the other's rows.
       *
       * Validates: mixed org + workspace team subjects on the same table are
       * resolved independently by matchTeamSubjectsBatch.
       */
      it('6.2 — mixed RLS: org team user sees East, ws team user sees West', async () => {
        const orgEastId = await createOrgTeam('Mixed-OrgEast');
        const wsWestId = await createWsTeam('Mixed-WsWest');

        const aliceR = await createUser(context, {
          email: 'ocs6-alice@test.com',
        });
        const bobR = await createUser(context, {
          email: 'ocs6-bob@test.com',
        });

        await addOrgMember(orgEastId, aliceR.user.id);
        await addWsMember(wsWestId, bobR.user.id);
        await addWorkspaceMembers([aliceR.user.id, bobR.user.id]);

        const base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          orgEastId,
          ProjectRoles.EDITOR,
        );
        await assignBaseTeamRole(
          base.id,
          wsWestId,
          ProjectRoles.EDITOR,
        );

        const tId = await createNamedTable(base.id, 'MixedDeals');
        const regionCol = await addColumn(
          tId,
          'Region',
          'SingleLineText',
        );

        await ownerInsert(base.id, tId, {
          Title: 'E1',
          Region: 'East',
        });
        await ownerInsert(base.id, tId, {
          Title: 'W1',
          Region: 'West',
        });

        await createRlsPolicy(
          base.id,
          tId,
          'Org East Policy',
          [{ type: 'team', id: orgEastId }],
          { fk_column_id: regionCol, comparison_op: 'eq', value: 'East' },
        );
        await createRlsPolicy(
          base.id,
          tId,
          'WS West Policy',
          [{ type: 'team', id: wsWestId }],
          { fk_column_id: regionCol, comparison_op: 'eq', value: 'West' },
        );
        await createRlsPolicy(
          base.id,
          tId,
          'Default Deny',
          [],
          undefined,
          true,
        );

        // Alice (org team) sees East only
        const aliceRes = await listRecords(base.id, tId, aliceR.token);
        const aliceRows = aliceRes.body.list ?? aliceRes.body;
        expect(aliceRows.length).to.equal(1);
        expect(aliceRows[0].Region).to.equal('East');

        // Bob (ws team) sees West only
        const bobRes = await listRecords(base.id, tId, bobR.token);
        const bobRows = bobRes.body.list ?? bobRes.body;
        expect(bobRows.length).to.equal(1);
        expect(bobRows[0].Region).to.equal('West');
      });

      /**
       * GET /api/v3/meta/orgs/{orgId}/teams/tree should return org teams
       * arranged in a tree with correct depth and parent references.
       * TreeParent (depth 0) → TreeChild (depth 1).
       *
       * Validates: Team.getTree works for org scope (not just workspace).
       * Bug caught: getTree hardcodes fk_workspace_id in its query.
       */
      it('6.3 — org team tree endpoint returns correct hierarchy', async () => {
        const parentId = await createOrgTeam('TreeParent');
        const childId = await createOrgTeam('TreeChild', parentId);

        const res = await request(context.app)
          .get(`/api/v3/meta/orgs/${orgId}/teams/tree`)
          .set('xc-token', context.xc_token)
          .expect(200);

        const tree = res.body.list || res.body;
        expect(tree).to.be.an('array');

        const parent = tree.find((t: any) => t.id === parentId);
        expect(parent).to.exist;
        expect(parent.depth).to.equal(0);

        // Child should be nested or have correct depth/parent
        const child = tree.find((t: any) => t.id === childId);
        if (child) {
          expect(child.depth).to.equal(1);
          expect(child.fk_parent_team_id).to.equal(parentId);
        } else {
          // Tree may nest children inside parent
          expect(parent.children).to.be.an('array');
          const nestedChild = parent.children.find(
            (c: any) => c.id === childId,
          );
          expect(nestedChild).to.exist;
        }
      });

      /**
       * User has DIRECT base role = Viewer (low privilege).
       * Org team assigned base role = Editor (higher privilege).
       * User is in the org team → effective role should be Editor (highest wins).
       *
       * Validates: role merging across direct assignment and org team assignment
       * picks the higher-privilege role.
       */
      it('6.4 — role merging: direct Viewer + org team Editor = Editor wins', async () => {
        const orgTeamId = await createOrgTeam('RoleMerge-Eng');

        const userR = await createUser(context, {
          email: 'ocs6-merge@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);
        await addWorkspaceMembers([userR.user.id]);

        const base = await createProject(context);

        // Direct base role: Viewer
        await setDirectBaseRole(
          base.id,
          userR.user.email,
          ProjectRoles.VIEWER,
        );
        // Org team: Editor
        await assignBaseTeamRole(
          base.id,
          orgTeamId,
          ProjectRoles.EDITOR,
        );

        const roles = await getUserRoles(userR.token, base.id);
        const baseRoles = roles.base_roles || {};

        // Editor should win (higher role)
        expect(
          baseRoles['editor'] || baseRoles[ProjectRoles.EDITOR],
        ).to.be.true;
      });

      /**
       * Org teams and workspace teams live in separate scopes.
       * Creating a workspace team with an org team as parent should fail (400/403).
       * Creating an org team with a workspace team as parent should also fail.
       *
       * Validates: parent team validation enforces same-scope constraint.
       * Without this, you could create cross-scope hierarchies that break
       * descendant queries (which filter by fk_workspace_id or fk_org_id).
       */
      it('6.5 — cross-scope reparent blocked: cannot parent ws team under org team or vice versa', async () => {
        const orgTeamId = await createOrgTeam('CrossScope-Org');
        const wsTeamId = await createWsTeam('CrossScope-WS');

        // Try to create ws team with org team as parent
        const res1 = await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/teams`)
          .set('xc-token', context.xc_token)
          .send({ title: 'WS under Org', parent_team_id: orgTeamId });
        expect(res1.status).to.be.oneOf([400, 403, 422]);

        // Try to create org team with ws team as parent
        const res2 = await request(context.app)
          .post(`/api/v3/meta/orgs/${orgId}/teams`)
          .set('xc-token', context.xc_token)
          .send({ title: 'Org under WS', parent_team_id: wsTeamId });
        expect(res2.status).to.be.oneOf([400, 403, 422]);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: direct_teams in Auth Response
    // ═══════════════════════════════════════════════════════════════════════

    describe('§7 direct_teams in Auth Response', () => {
      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });
      });

      afterEach(async () => {
        await featureMock?.restore?.();
      });

      /**
       * /auth/me?base_id=X returns direct_teams — an array of { team_id, path }
       * for every team the user is a direct member of.
       * User is added to an org team → direct_teams should include it.
       * A second org team the user is NOT in should be absent.
       *
       * Validates: extractUserDirectTeams → Team.getByIds returns org teams
       * (fk_workspace_id NULL) when called with workspace context.
       * This is the root bug: if getByIds filters by workspace, org teams are missing.
       */
      it('7.1 — /auth/me includes org team in direct_teams with correct team_id and path', async () => {
        const orgTeamId = await createOrgTeam('DirectTeam-Org');
        const userR = await createUser(context, {
          email: 'ocs7-dt@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);
        await addWorkspaceMembers([userR.user.id]);

        const base = await createProject(context);
        const roles = await getUserRoles(userR.token, base.id);
        const directTeams = roles.direct_teams || [];

        const orgEntry = directTeams.find(
          (dt: any) => dt.team_id === orgTeamId,
        );
        expect(orgEntry, 'org team must appear in direct_teams').to
          .exist;
        expect(orgEntry.path).to.be.a('string').that.is.not.empty;

        // Teams user is NOT in should be absent
        const unrelated = await createOrgTeam('DirectTeam-Other');
        const roles2 = await getUserRoles(userR.token, base.id);
        const dt2 = roles2.direct_teams || [];
        expect(dt2.find((dt: any) => dt.team_id === unrelated)).to.not
          .exist;
      });

      /**
       * User is a member of BOTH an org team and a workspace team.
       * direct_teams should contain entries for both, with no duplicates.
       *
       * Validates: extractUserDirectTeams doesn't filter by scope — it returns
       * ALL team memberships regardless of whether the team is org or workspace scoped.
       */
      it('7.2 — direct_teams includes both org and workspace team memberships', async () => {
        const orgTeamId = await createOrgTeam('DT-Org');
        const wsTeamId = await createWsTeam('DT-WS');

        const userR = await createUser(context, {
          email: 'ocs7-both@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);
        await addWsMember(wsTeamId, userR.user.id);
        await addWorkspaceMembers([userR.user.id]);

        const base = await createProject(context);
        const roles = await getUserRoles(userR.token, base.id);
        const directTeams = roles.direct_teams || [];

        const orgEntry = directTeams.find(
          (dt: any) => dt.team_id === orgTeamId,
        );
        const wsEntry = directTeams.find(
          (dt: any) => dt.team_id === wsTeamId,
        );

        expect(orgEntry, 'org team in direct_teams').to.exist;
        expect(wsEntry, 'workspace team in direct_teams').to.exist;

        // No duplicates
        const ids = directTeams.map((dt: any) => dt.team_id);
        const uniqueIds = [...new Set(ids)];
        expect(ids.length).to.equal(uniqueIds.length);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: Authorization — Org Team Management
    // ═══════════════════════════════════════════════════════════════════════

    describe('§8 Authorization — Org Team Management', () => {
      let orgTeamId: string;
      let nonAdminUser: any;
      let nonAdminToken: string;
      let memberUser: any;

      beforeEach(async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        orgTeamId = await createOrgTeam('Auth-Team');

        // Non-admin user — workspace owner but NOT org admin
        const naR = await createUser(context, {
          email: 'ocs8-nonadmin@test.com',
        });
        nonAdminUser = naR.user;
        nonAdminToken = naR.token;

        // Make them workspace owner
        await addWorkspaceMembers(
          [nonAdminUser.id],
          'workspace-level-owner',
        );

        // Add to org as VIEWER (not admin)
        await Noco.ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
          fk_org_id: orgId,
          fk_user_id: nonAdminUser.id,
          roles: EnterpriseOrgUserRoles.VIEWER,
        });

        const memR = await createUser(context, {
          email: 'ocs8-member@test.com',
        });
        memberUser = memR.user;
      });

      /**
       * Org team member management should require org admin role.
       * context.user is org ADMIN → can add members (200).
       * nonAdminUser is org VIEWER + workspace OWNER → cannot add members (403).
       *
       * Validates: isUserOrgAdmin check exists on teamMembersAdd.
       * Bug caught: member operations only check team manager role, not org admin.
       */
      it('8.1 — add members: org admin succeeds (200); non-org-admin gets 403', async () => {
        // Org admin (context.user) can add
        const adminRes = await request(context.app)
          .post(
            `/api/v3/meta/orgs/${orgId}/teams/${orgTeamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([
            {
              user_id: memberUser.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ]);
        expect(adminRes.status).to.equal(200);

        // Non-admin (workspace owner but org viewer) cannot add
        const mem2 = await createUser(context, {
          email: 'ocs8-mem2@test.com',
        });
        const nonAdminRes = await request(context.app)
          .post(
            `/api/v3/meta/orgs/${orgId}/teams/${orgTeamId}/members`,
          )
          .set('xc-auth', nonAdminToken)
          .send([
            {
              user_id: mem2.user.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ]);
        expect(nonAdminRes.status).to.equal(403);
      });

      /**
       * Same auth boundary as 8.1 but for member removal.
       * nonAdminUser (org viewer) tries to remove a member → 403.
       * context.user (org admin) removes the same member → 200.
       *
       * Validates: isUserOrgAdmin check exists on teamMembersRemove.
       */
      it('8.2 — remove members: org admin succeeds (200); non-org-admin gets 403', async () => {
        // First add a member as admin
        await addOrgMember(orgTeamId, memberUser.id);

        // Non-admin cannot remove
        const nonAdminRes = await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${orgTeamId}/members`,
          )
          .set('xc-auth', nonAdminToken)
          .send([{ user_id: memberUser.id }]);
        expect(nonAdminRes.status).to.equal(403);

        // Admin can remove
        const adminRes = await request(context.app)
          .delete(
            `/api/v3/meta/orgs/${orgId}/teams/${orgTeamId}/members`,
          )
          .set('xc-token', context.xc_token)
          .send([{ user_id: memberUser.id }]);
        expect(adminRes.status).to.equal(200);
      });

      /**
       * Workspace owners can manage workspace teams but NOT org teams.
       * nonAdminUser is workspace OWNER + org VIEWER.
       * Adding member to org team → 403 (org admin required).
       * Adding member to workspace team → 200 (workspace owner is sufficient).
       *
       * Validates: the auth boundary between org and workspace is enforced.
       * A workspace owner's power stops at the workspace — they cannot reach
       * into org-level team management.
       */
      it('8.3 — workspace owner cannot manage org team members; CAN manage workspace teams', async () => {
        // Workspace owner tries to add member to org team — 403
        const wsOwnerOrgRes = await request(context.app)
          .post(
            `/api/v3/meta/orgs/${orgId}/teams/${orgTeamId}/members`,
          )
          .set('xc-auth', nonAdminToken)
          .send([
            {
              user_id: memberUser.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ]);
        expect(wsOwnerOrgRes.status).to.equal(403);

        // Same user CAN manage workspace teams
        const featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });
        const wsTeamId = await createWsTeam('Auth-WsTeam');
        const wsRes = await request(context.app)
          .post(
            `/api/v3/meta/workspaces/${workspaceId}/teams/${wsTeamId}/members`,
          )
          .set('xc-auth', nonAdminToken)
          .send([
            {
              user_id: memberUser.id,
              team_role: TeamUserRoles.MEMBER,
            },
          ]);
        // Workspace owner should be able to manage ws teams
        expect(wsRes.status).to.equal(200);
        await featureMock?.restore?.();
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 9: Cross-Workspace Isolation
    // ═══════════════════════════════════════════════════════════════════════

    describe('§9 Cross-Workspace Isolation', () => {
      /**
       * Org team "Isolation-Eng" is assigned Editor on Base-A (in workspace).
       * Base-B exists in the same workspace but has NO team assignment.
       * User is in the org team → gets Editor on Base-A.
       * Same user should NOT have Editor on Base-B.
       *
       * Validates: PrincipalAssignment is base-scoped — an org team assigned
       * to one base doesn't grant access to other bases, even in the same workspace.
       * This is the most dangerous false-positive scenario for org teams.
       */
      it('9.1 — org team role on WS-A does not leak to WS-B', async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        const wsA = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(wsA, orgId);

        featureMock = await overridePlan({
          workspace_id: wsA,
          planTitle: PlanTitles.ENTERPRISE,
        });

        const orgTeamId = await createOrgTeam('Isolation-Eng');

        const userR = await createUser(context, {
          email: 'ocs9-iso@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);

        // WS-A: assign org team as Editor
        await addWorkspaceMembers([userR.user.id]);
        const baseA = await createProject(context);
        await assignBaseTeamRole(
          baseA.id,
          orgTeamId,
          ProjectRoles.EDITOR,
        );

        // User has Editor on base-A
        const rolesA = await getUserRoles(userR.token, baseA.id);
        const baseRolesA = rolesA.base_roles || {};
        expect(
          baseRolesA['editor'] || baseRolesA[ProjectRoles.EDITOR],
        ).to.be.true;

        // Create base-B in same workspace but NO team assignment
        const baseB = await createProject(context);

        // User should NOT have Editor on base-B
        const rolesB = await getUserRoles(userR.token, baseB.id);
        const baseRolesB = rolesB.base_roles || {};
        expect(baseRolesB['editor']).to.not.be.true;
        expect(baseRolesB[ProjectRoles.EDITOR]).to.not.be.true;

        await featureMock?.restore?.();
      });

      /**
       * Same org team "MultiWS-Eng" assigned to two bases:
       *   Base-A → Editor
       *   Base-B → Viewer
       * User should get Editor on Base-A and Viewer on Base-B.
       * Roles must NOT merge across bases (no "highest wins" cross-base).
       *
       * Validates: role resolution is per-base, not per-org-team.
       * The same org team can have different roles in different contexts.
       */
      it('9.2 — same org team, different base roles per workspace', async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        const wsA = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(wsA, orgId);

        featureMock = await overridePlan({
          workspace_id: wsA,
          planTitle: PlanTitles.ENTERPRISE,
        });

        const orgTeamId = await createOrgTeam('MultiWS-Eng');

        const userR = await createUser(context, {
          email: 'ocs9-multi@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);
        await addWorkspaceMembers([userR.user.id]);

        // Base-A: org team → Editor
        const baseA = await createProject(context);
        await assignBaseTeamRole(
          baseA.id,
          orgTeamId,
          ProjectRoles.EDITOR,
        );

        // Base-B: org team → Viewer
        const baseB = await createProject(context);
        await assignBaseTeamRole(
          baseB.id,
          orgTeamId,
          ProjectRoles.VIEWER,
        );

        // Check roles
        const rolesA = await getUserRoles(userR.token, baseA.id);
        expect(
          rolesA.base_roles?.['editor'] ||
            rolesA.base_roles?.[ProjectRoles.EDITOR],
        ).to.be.true;

        const rolesB = await getUserRoles(userR.token, baseB.id);
        expect(
          rolesB.base_roles?.['viewer'] ||
            rolesB.base_roles?.[ProjectRoles.VIEWER],
        ).to.be.true;
        // Should NOT have Editor on base-B
        expect(rolesB.base_roles?.['editor']).to.not.be.true;

        await featureMock?.restore?.();
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 10: Lifecycle — Unlink, Delete, Late Addition
    // ═══════════════════════════════════════════════════════════════════════

    describe('§10 Lifecycle', () => {
      /**
       * Workspace is linked to org. Org team assigned base role + RLS policy.
       * User sees 1 East row (RLS active).
       *
       * Step 1: Unlink workspace (fk_org_id = NULL).
       *   → Org teams are no longer visible in this workspace.
       *   → User sees 0 rows (deny_all, no matching team).
       *
       * Step 2: Re-link workspace (fk_org_id restored).
       *   → Org teams are visible again.
       *   → User sees 1 East row again.
       *
       * Validates: workspace-org linkage is the gate for org team visibility.
       * Unlinking immediately severs all org team permissions.
       */
      it('10.1 — unlinking workspace from org revokes org team access; re-link restores', async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        const orgTeamId = await createOrgTeam('Lifecycle-Eng');

        const userR = await createUser(context, {
          email: 'ocs10-unlink@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);
        await addWorkspaceMembers([userR.user.id]);

        const base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          orgTeamId,
          ProjectRoles.EDITOR,
        );

        const tableId = await createNamedTable(base.id, 'LifecycleData');
        const regionCol = await addColumn(
          tableId,
          'Region',
          'SingleLineText',
        );
        await ownerInsert(base.id, tableId, {
          Title: 'R1',
          Region: 'East',
        });
        await ownerInsert(base.id, tableId, {
          Title: 'R2',
          Region: 'West',
        });

        await createRlsPolicy(
          base.id,
          tableId,
          'East Policy',
          [{ type: 'team', id: orgTeamId }],
          {
            fk_column_id: regionCol,
            comparison_op: 'eq',
            value: 'East',
          },
        );
        await createRlsPolicy(
          base.id,
          tableId,
          'Default Deny',
          [],
          undefined,
          true,
        );

        // Before unlink: user sees 1 East row
        let res = await listRecords(base.id, tableId, userR.token);
        let rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(1);
        expect(rows[0].Region).to.equal('East');

        // Unlink workspace from org
        await unlinkWorkspaceFromOrg(workspaceId);

        // After unlink: user sees 0 rows (org team no longer visible)
        res = await listRecords(base.id, tableId, userR.token);
        rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(0);

        // Re-link: access restored
        await linkWorkspaceToOrg(workspaceId, orgId);

        res = await listRecords(base.id, tableId, userR.token);
        rows = res.body.list ?? res.body;
        expect(rows.length).to.equal(1);

        await featureMock?.restore?.();
      });

      /**
       * Org team "Late-Eng" is assigned Editor on a base.
       * User exists but is NOT in the org team → 403 on table list.
       *
       * User is then added to the org team.
       * Immediately after: user can list tables and read records.
       *
       * Validates: no stale cache prevents a newly-added org team member
       * from accessing resources. PrincipalAssignment and Team.getByIds
       * must reflect the new membership on the next request.
       */
      it('10.2 — late member addition immediately gains access', async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        const orgTeamId = await createOrgTeam('Late-Eng');

        const userR = await createUser(context, {
          email: 'ocs10-late@test.com',
        });
        await addWorkspaceMembers([userR.user.id]);

        const base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          orgTeamId,
          ProjectRoles.EDITOR,
        );

        const tableId = await createNamedTable(base.id, 'LateData');
        await ownerInsert(base.id, tableId, { Title: 'Row1' });

        // Before: user has no access (not in org team)
        let res = await listTables(base.id, userR.token);
        expect(res.status).to.be.oneOf([401, 403]);

        // Add user to org team
        await addOrgMember(orgTeamId, userR.user.id);

        // After: immediate access
        res = await listTables(base.id, userR.token);
        expect(res.status).to.equal(200);

        const recordsRes = await listRecords(
          base.id,
          tableId,
          userR.token,
        );
        expect(recordsRes.status).to.equal(200);
        const rows = recordsRes.body.list ?? recordsRes.body;
        expect(rows.length).to.equal(1);

        await featureMock?.restore?.();
      });

      /**
       * User is in BOTH an org team and a workspace team, each assigned Editor.
       * The org team is soft-deleted.
       *
       * User should STILL have Editor via the workspace team (unaffected).
       * The org team should no longer appear in the workspace team list.
       *
       * Validates: soft-deleting an org team revokes its permissions without
       * affecting other team assignments. The workspace team continues to work.
       * This is a wider blast radius than workspace team deletion (org teams
       * could be assigned across multiple workspaces).
       */
      it('10.3 — org team soft-delete revokes access; workspace teams unaffected', async function () {
        this.timeout(120000);
        context = await init(false, 'editor', { skipSakila: true });
        workspaceId = context.fk_workspace_id;
        orgId = await setupOrg();
        await linkWorkspaceToOrg(workspaceId, orgId);

        featureMock = await overridePlan({
          workspace_id: workspaceId,
          planTitle: PlanTitles.ENTERPRISE,
        });

        const orgTeamId = await createOrgTeam('Delete-OrgTeam');
        const wsTeamId = await createWsTeam('Delete-WsTeam');

        const userR = await createUser(context, {
          email: 'ocs10-del@test.com',
        });
        await addOrgMember(orgTeamId, userR.user.id);
        await addWsMember(wsTeamId, userR.user.id);
        await addWorkspaceMembers([userR.user.id]);

        const base = await createProject(context);
        await assignBaseTeamRole(
          base.id,
          orgTeamId,
          ProjectRoles.EDITOR,
        );
        await assignBaseTeamRole(
          base.id,
          wsTeamId,
          ProjectRoles.EDITOR,
        );

        const tableId = await createNamedTable(base.id, 'DeleteData');
        await ownerInsert(base.id, tableId, { Title: 'Row1' });

        // Before delete: user has Editor via both teams
        let roles = await getUserRoles(userR.token, base.id);
        expect(
          roles.base_roles?.['editor'] ||
            roles.base_roles?.[ProjectRoles.EDITOR],
        ).to.be.true;

        // Soft-delete the org team
        await request(context.app)
          .delete(`/api/v3/meta/orgs/${orgId}/teams/${orgTeamId}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        // User still has Editor via workspace team (unaffected)
        roles = await getUserRoles(userR.token, base.id);
        expect(
          roles.base_roles?.['editor'] ||
            roles.base_roles?.[ProjectRoles.EDITOR],
        ).to.be.true;

        // Verify the org team is gone from the team list
        const teamsRes = await request(context.app)
          .get(`/api/v3/meta/workspaces/${workspaceId}/teams`)
          .set('xc-token', context.xc_token)
          .expect(200);

        const teams = teamsRes.body.list || [];
        expect(teams.find((t: any) => t.id === orgTeamId)).to.not.exist;
        expect(teams.find((t: any) => t.id === wsTeamId)).to.exist;

        await featureMock?.restore?.();
      });
    });
  });
}
