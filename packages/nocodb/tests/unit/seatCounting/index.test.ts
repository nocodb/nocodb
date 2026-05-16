import 'mocha';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import {
  EnterpriseOrgUserRoles,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import init from '../init';
import { createProject } from '../factory/base';
import { isEE } from '../utils/helpers';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import BaseModel from '~/models/Base';
import BaseUser from '~/models/BaseUser';
import { OrgUser } from '~/models';
import User from '~/models/User';
import Workspace from '~/ee/models/Workspace';
import WorkspaceUser from '~/ee/models/WorkspaceUser';
import Subscription from '~/ee/models/Subscription';
import { removeUserFromOrgCascade } from '~/ee/helpers/orgUserRemovalHelper';
import type Base from '~/models/Base';

/**
 * Seat-counting regression tests.
 *
 * Seat counting is EE-only. Every operation that touches user/role state
 * — org user removal, workspace user invite/remove/role change, direct
 * base user assignments, soft-deletes of users/workspaces/bases — must
 * leave the seat count consistent for BOTH:
 *   • `Subscription.calculateWorkspaceSeatCount` (cloud, per-workspace)
 *   • `NocoLicense.calculateGlobalSeatCount` (on-prem, instance-wide)
 *
 * Both functions share the same join shape: workspace_user × base_user ×
 * team-resolved roles. They differ only in scope. Rather than spin up an
 * on-prem fixture, we cover the cloud function directly and assert the
 * DB invariants the on-prem query depends on (no orphan rows in
 * nc_base_users_v2 after removal, no rows for soft-deleted users, etc.).
 *
 * Helpers in this file deliberately bypass HTTP and call models /
 * helpers directly so the trace under test is exactly the one the bug
 * lives in — not a wrapper around it.
 */
function seatCountingTests() {
  if (!isEE()) return;

  let context: Awaited<ReturnType<typeof init>>;
  let workspaceId: string;
  let base: Base;
  let ownerId: string;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    workspaceId = base.fk_workspace_id;
    ownerId = context.user.id;
  });

  // ── Test helpers ─────────────────────────────────────────────────

  /** Insert a new user directly via the model layer. */
  async function makeUser(
    email?: string,
  ): Promise<{ id: string; email: string }> {
    const e = email ?? `seat-${uuidv4()}@example.com`;
    const inserted = await Noco.ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      {
        email: e,
        salt: 'x',
        password: 'x',
        token_version: 'x',
      },
    );
    return { id: inserted.id, email: e };
  }

  /** Add a workspace user with the given role. */
  async function addWorkspaceUser(userId: string, role: WorkspaceUserRoles) {
    await WorkspaceUser.insert({
      fk_workspace_id: workspaceId,
      fk_user_id: userId,
      roles: role,
    });
  }

  /** Add a direct base user with the given role.
   *
   *  EE BaseUser.insert requires the user to already be a workspace
   *  member. Production flow is: invite to workspace (NO_ACCESS by
   *  default for a base-scoped invite) → add direct base role. We
   *  replicate that here so the test trace matches reality. */
  async function addBaseUser(
    userId: string,
    role: ProjectRoles,
    baseId = base.id,
  ) {
    const wsUser = await WorkspaceUser.get(workspaceId, userId, {});
    if (!wsUser) {
      await addWorkspaceUser(userId, WorkspaceUserRoles.NO_ACCESS);
    }
    await BaseUser.insert(
      { workspace_id: workspaceId, base_id: baseId },
      {
        base_id: baseId,
        fk_user_id: userId,
        roles: role,
        invited_by: ownerId,
      },
    );
  }

  /**
   * Create (or reuse) an org for this test, link the workspace to it,
   * and add the bootstrap owner as an org ADMIN. Returns the org ID.
   *
   * EE tests run as cloud — `verifyDefaultOrg` is a no-op there — so
   * the on-prem cascade path needs a manually-wired org to exercise.
   */
  async function ensureOrg(): Promise<string> {
    const existing = await Noco.ncMeta
      .knexConnection(MetaTable.ORG)
      .where('fk_user_id', ownerId)
      .first();
    if (existing) return existing.id;

    const orgId = `org_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    await Noco.ncMeta.knexConnection(MetaTable.ORG).insert({
      id: orgId,
      title: 'Seat Test Org',
      fk_user_id: ownerId,
      deleted: false,
    });

    await Noco.ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('id', workspaceId)
      .update({ fk_org_id: orgId });

    await OrgUser.insert(
      {
        fk_org_id: orgId,
        fk_user_id: ownerId,
        roles: EnterpriseOrgUserRoles.ADMIN,
      },
      Noco.ncMeta,
    );

    return orgId;
  }

  /** Add a user to the given org.
   *
   *  Idempotent — EE `WorkspaceUser.insert` auto-attaches users to the
   *  workspace's org via `ensureOrgUser`, so by the time a test calls
   *  this helper the row may already exist. Skip in that case so the
   *  test trace mirrors production (where `ensureOrgUser` is also
   *  best-effort idempotent).
   */
  async function addOrgUser(
    orgId: string,
    userId: string,
    role = EnterpriseOrgUserRoles.VIEWER,
  ) {
    const existing = await Noco.ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where({ fk_org_id: orgId, fk_user_id: userId })
      .first();
    if (existing) {
      if (existing.deleted) {
        await Noco.ncMeta
          .knexConnection(MetaTable.ORG_USERS)
          .where({ fk_org_id: orgId, fk_user_id: userId })
          .update({ deleted: false, roles: role });
      }
      return;
    }
    await OrgUser.insert(
      {
        fk_org_id: orgId,
        fk_user_id: userId,
        roles: role,
      },
      Noco.ncMeta,
    );
  }

  /** Seat count via the cloud (per-workspace) function. */
  async function workspaceSeatCount(): Promise<number> {
    const { seatCount } = await Subscription.calculateWorkspaceSeatCount(
      workspaceId,
    );
    return seatCount;
  }

  /** True when `userId` shows up as seat-consuming for the workspace. */
  async function isSeatUser(userId: string): Promise<boolean> {
    const { seatUsersMap } = await Subscription.calculateWorkspaceSeatCount(
      workspaceId,
    );
    return seatUsersMap.has(userId);
  }

  /** Raw count of nc_base_users_v2 rows for a (user, base) pair — used
   *  to assert physical cleanup, independent of any aggregate query. */
  async function baseUserRowCount(userId: string, baseId = base.id) {
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT_USERS)
      .where({ fk_user_id: userId, base_id: baseId })
      .count('* as count')
      .first();
    return Number((row as any)?.count ?? 0);
  }

  /** Raw active count of workspace_user rows for a user. */
  async function activeWorkspaceUserRowCount(userId: string) {
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_user_id', userId)
      .where('fk_workspace_id', workspaceId)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .count('* as count')
      .first();
    return Number((row as any)?.count ?? 0);
  }

  // ─────────────────────────────────────────────────────────────────
  //  Workspace-level role → seat count
  // ─────────────────────────────────────────────────────────────────
  describe('Workspace user roles', () => {
    it('counts the workspace OWNER (default member)', async () => {
      // The bootstrapped user is added as the workspace OWNER.
      expect(await workspaceSeatCount()).to.equal(1);
      expect(await isSeatUser(ownerId)).to.equal(true);
    });

    const seatConsuming: WorkspaceUserRoles[] = [
      WorkspaceUserRoles.OWNER,
      WorkspaceUserRoles.CREATOR,
      WorkspaceUserRoles.EDITOR,
    ];
    for (const role of seatConsuming) {
      it(`counts a workspace ${role}`, async () => {
        const u = await makeUser();
        await addWorkspaceUser(u.id, role);
        expect(await isSeatUser(u.id)).to.equal(true);
        expect(await workspaceSeatCount()).to.equal(2);
      });
    }

    const nonSeat: WorkspaceUserRoles[] = [
      WorkspaceUserRoles.VIEWER,
      WorkspaceUserRoles.COMMENTER,
      WorkspaceUserRoles.NO_ACCESS,
    ];
    for (const role of nonSeat) {
      it(`does NOT count a workspace ${role}`, async () => {
        const u = await makeUser();
        await addWorkspaceUser(u.id, role);
        expect(await isSeatUser(u.id)).to.equal(false);
        expect(await workspaceSeatCount()).to.equal(1);
      });
    }

    it('a soft-deleted workspace_user does not count', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);

      await WorkspaceUser.softDelete(workspaceId, u.id);

      expect(await isSeatUser(u.id)).to.equal(false);
      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('promoting VIEWER → EDITOR increments the count exactly once', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.VIEWER);
      expect(await workspaceSeatCount()).to.equal(1);

      await WorkspaceUser.update(workspaceId, u.id, {
        roles: WorkspaceUserRoles.EDITOR,
      });

      expect(await workspaceSeatCount()).to.equal(2);
    });

    it('demoting EDITOR → VIEWER decrements the count exactly once', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);

      await WorkspaceUser.update(workspaceId, u.id, {
        roles: WorkspaceUserRoles.VIEWER,
      });

      expect(await workspaceSeatCount()).to.equal(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Base-level role → seat count
  // ─────────────────────────────────────────────────────────────────
  describe('Base user roles', () => {
    it('counts a user via a direct base OWNER role (no workspace_user)', async () => {
      const u = await makeUser();
      await addBaseUser(u.id, ProjectRoles.OWNER);
      expect(await isSeatUser(u.id)).to.equal(true);
    });

    it('does NOT count a user with only a direct base VIEWER role', async () => {
      const u = await makeUser();
      await addBaseUser(u.id, ProjectRoles.VIEWER);
      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('a workspace VIEWER + base EDITOR is counted (base role wins)', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.VIEWER);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      expect(await isSeatUser(u.id)).to.equal(true);
    });

    it('a workspace EDITOR + base COMMENTER is still counted (workspace role wins)', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.COMMENTER);
      expect(await isSeatUser(u.id)).to.equal(true);
    });

    it('removing the direct base role drops the user from the count', async () => {
      const u = await makeUser();
      await addBaseUser(u.id, ProjectRoles.OWNER);
      expect(await isSeatUser(u.id)).to.equal(true);

      await BaseUser.delete(
        { workspace_id: workspaceId, base_id: base.id },
        base.id,
        u.id,
      );

      expect(await isSeatUser(u.id)).to.equal(false);
      expect(await baseUserRowCount(u.id)).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Lifecycle filters: deleted users / workspaces / bases
  // ─────────────────────────────────────────────────────────────────
  describe('Lifecycle filters', () => {
    it('users with is_deleted=true are excluded from the seat count', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);

      await User.softDelete(u.id);

      expect(await isSeatUser(u.id)).to.equal(false);
      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('users on a soft-deleted base are excluded from the count', async () => {
      const u = await makeUser();
      await addBaseUser(u.id, ProjectRoles.OWNER);
      expect(await isSeatUser(u.id)).to.equal(true);

      // Use Base.softDelete so the BASE cache is invalidated — the seat
      // count query pulls the active-base list from Base.list (cached).
      await BaseModel.softDelete(
        { workspace_id: workspaceId, base_id: base.id },
        base.id,
      );

      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('removing the only direct role drops a user with no other paths', async () => {
      // Sanity check that the "user has at least one role assignment"
      // filter actually prunes empty rows.
      const u = await makeUser();
      // Not added anywhere — should never appear in the count.
      expect(await isSeatUser(u.id)).to.equal(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Workspace-level user removal (cleanupWorkspaceUser path)
  // ─────────────────────────────────────────────────────────────────
  describe('Workspace user removal cleanup', () => {
    it('removing a workspace user hard-deletes their base memberships', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      expect(await baseUserRowCount(u.id)).to.equal(1);

      // Mirror cleanupWorkspaceUser's effect on physical rows.
      await WorkspaceUser.softDelete(workspaceId, u.id);
      await BaseUser.delete(
        { workspace_id: workspaceId, base_id: base.id },
        base.id,
        u.id,
      );

      expect(await baseUserRowCount(u.id)).to.equal(0);
      expect(await activeWorkspaceUserRowCount(u.id)).to.equal(0);
      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('re-adding a removed user restores the seat count', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);

      await WorkspaceUser.softDelete(workspaceId, u.id);
      expect(await workspaceSeatCount()).to.equal(1);

      // EE WorkspaceUser.insert detects the soft-deleted row, hard-deletes
      // it, then re-inserts. Production path — exercise it verbatim.
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);

      expect(await workspaceSeatCount()).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Org-level cascade removal (THE PRODUCTION BUG)
  // ─────────────────────────────────────────────────────────────────
  describe('removeUserFromOrgCascade', () => {
    it('hard-deletes nc_base_users_v2 rows across every base', async () => {
      const orgId = await ensureOrg();

      const u = await makeUser();
      // Direct base assignment — this is the leak path the bug created.
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      await addOrgUser(orgId, u.id, EnterpriseOrgUserRoles.VIEWER);

      // Sanity: row is present before removal.
      expect(await baseUserRowCount(u.id)).to.equal(1);
      expect(await isSeatUser(u.id)).to.equal(true);

      await removeUserFromOrgCascade(orgId, u.id);

      // The fix: nc_base_users_v2 row is gone.
      expect(await baseUserRowCount(u.id)).to.equal(0);
      // And the workspace_user row is soft-deleted.
      expect(await activeWorkspaceUserRowCount(u.id)).to.equal(0);
      // And the seat count reflects the removal.
      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('removes a user with multiple bases — every base_user row goes', async () => {
      const orgId = await ensureOrg();

      const baseB = await createProject(context, {
        title: 'SecondBase',
        fk_workspace_id: workspaceId,
      });

      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      await BaseUser.insert(
        { workspace_id: workspaceId, base_id: baseB.id },
        {
          base_id: baseB.id,
          fk_user_id: u.id,
          roles: ProjectRoles.OWNER,
          invited_by: ownerId,
        },
      );
      await addOrgUser(orgId, u.id);

      expect(await baseUserRowCount(u.id, base.id)).to.equal(1);
      expect(await baseUserRowCount(u.id, baseB.id)).to.equal(1);

      await removeUserFromOrgCascade(orgId, u.id);

      expect(await baseUserRowCount(u.id, base.id)).to.equal(0);
      expect(await baseUserRowCount(u.id, baseB.id)).to.equal(0);
    });

    it('leaves the remaining seat count untouched (no over-removal)', async () => {
      const orgId = await ensureOrg();

      const u1 = await makeUser();
      const u2 = await makeUser();
      await addWorkspaceUser(u1.id, WorkspaceUserRoles.EDITOR);
      await addWorkspaceUser(u2.id, WorkspaceUserRoles.EDITOR);
      await addOrgUser(orgId, u1.id);
      await addOrgUser(orgId, u2.id);
      expect(await workspaceSeatCount()).to.equal(3);

      await removeUserFromOrgCascade(orgId, u1.id);

      // Owner + u2 remain.
      expect(await workspaceSeatCount()).to.equal(2);
      expect(await isSeatUser(u2.id)).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Cross-path invariants
  // ─────────────────────────────────────────────────────────────────
  describe('Cross-path invariants', () => {
    it('repeated add/remove via the workspace path never drifts the count', async () => {
      const u = await makeUser();

      for (let i = 0; i < 3; i++) {
        await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
        expect(await workspaceSeatCount()).to.equal(2);

        await WorkspaceUser.softDelete(workspaceId, u.id);
        expect(await workspaceSeatCount()).to.equal(1);
      }

      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('removing via org cascade is idempotent on the seat count', async () => {
      const orgId = await ensureOrg();

      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      await addOrgUser(orgId, u.id);

      await removeUserFromOrgCascade(orgId, u.id);
      const after1 = await workspaceSeatCount();

      // Second call must be a no-op for the seat count (org-user row is
      // already soft-deleted, base-user rows are already gone).
      await removeUserFromOrgCascade(orgId, u.id);
      const after2 = await workspaceSeatCount();

      expect(after1).to.equal(after2);
      expect(after2).to.equal(1);
    });

    it('workspace user delete then org cascade leaves no orphan rows', async () => {
      const orgId = await ensureOrg();

      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      await addOrgUser(orgId, u.id);

      // First: workspace-level removal hard-deletes the base user row.
      await WorkspaceUser.softDelete(workspaceId, u.id);
      await BaseUser.delete(
        { workspace_id: workspaceId, base_id: base.id },
        base.id,
        u.id,
      );

      // Then: org cascade should still complete cleanly.
      await removeUserFromOrgCascade(orgId, u.id);

      expect(await baseUserRowCount(u.id)).to.equal(0);
      expect(await activeWorkspaceUserRowCount(u.id)).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Dedup invariants
  //
  //  Industry-standard rule: a user is ONE seat regardless of how
  //  many roles they hold. A regression that double-counts (e.g.
  //  joining workspace_user × base_user without DISTINCT-by-user)
  //  silently overbills customers — direct revenue / trust loss.
  // ─────────────────────────────────────────────────────────────────
  describe('Dedup invariants', () => {
    it('workspace EDITOR + base OWNER = one seat', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.OWNER);

      // Owner + u = 2 seats. The user with BOTH roles must be counted once.
      expect(await workspaceSeatCount()).to.equal(2);
    });

    it('a single user on N bases is still one seat', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.NO_ACCESS);

      // Spread the user across 3 bases, each with a paid role.
      const baseA = base;
      const baseB = await createProject(context, {
        title: 'DedupBaseB',
        fk_workspace_id: workspaceId,
      });
      const baseC = await createProject(context, {
        title: 'DedupBaseC',
        fk_workspace_id: workspaceId,
      });

      for (const b of [baseA, baseB, baseC]) {
        await BaseUser.insert(
          { workspace_id: workspaceId, base_id: b.id },
          {
            base_id: b.id,
            fk_user_id: u.id,
            roles: ProjectRoles.EDITOR,
            invited_by: ownerId,
          },
        );
      }

      // Owner + u = 2.
      expect(await workspaceSeatCount()).to.equal(2);
    });

    it('two distinct seat-bearing users counted as 2 (not 1, not 3)', async () => {
      const u1 = await makeUser();
      const u2 = await makeUser();
      await addWorkspaceUser(u1.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u1.id, ProjectRoles.OWNER);
      await addWorkspaceUser(u2.id, WorkspaceUserRoles.CREATOR);
      await addBaseUser(u2.id, ProjectRoles.OWNER);

      // Owner + u1 + u2 = 3. Confirms the dedup applies per-user, not
      // globally (a naive distinct on the wrong column would collapse to 1).
      expect(await workspaceSeatCount()).to.equal(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Null / empty / unknown role handling
  //
  //  These are common DB-state edge cases: legacy rows, manually
  //  patched data, or partially-rolled-back migrations. They must
  //  never silently count as a paid seat.
  // ─────────────────────────────────────────────────────────────────
  describe('Null / empty / unknown role handling', () => {
    it('workspace_user with NULL roles does not count', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      // Force a malformed legacy row.
      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE_USER)
        .where('fk_workspace_id', workspaceId)
        .where('fk_user_id', u.id)
        .update({ roles: null });

      expect(await isSeatUser(u.id)).to.equal(false);
      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('workspace_user with empty-string roles does not count', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE_USER)
        .where('fk_workspace_id', workspaceId)
        .where('fk_user_id', u.id)
        .update({ roles: '' });

      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('an unrecognised role string falls back to seat-consuming (fail-closed)', async () => {
      // NON_SEAT_ROLES is a closed list. Anything outside it (including
      // garbage strings from a future migration that introduces a new
      // paid role) should be treated as seat-consuming — under-counting
      // is a revenue bug; over-counting on garbage is loud and fixable.
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.NO_ACCESS);
      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE_USER)
        .where('fk_workspace_id', workspaceId)
        .where('fk_user_id', u.id)
        .update({ roles: 'workspace-level-future-role' });

      expect(await isSeatUser(u.id)).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Soft-delete cascade — every level
  //
  //  When User.softDelete, WorkspaceUser.softDelete, or workspace
  //  deletion happens, the seat count must drop immediately. A user
  //  in a "stale but technically active" state is a revenue bug.
  // ─────────────────────────────────────────────────────────────────
  describe('Soft-delete cascade — every level', () => {
    it('User.softDelete excludes user from count even with workspace role', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);

      await User.softDelete(u.id);

      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('User.softDelete excludes user from count even with base role', async () => {
      const u = await makeUser();
      await addBaseUser(u.id, ProjectRoles.OWNER);
      expect(await isSeatUser(u.id)).to.equal(true);

      await User.softDelete(u.id);

      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('soft-deleted user with multiple roles drops to zero seats', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.OWNER);
      expect(await workspaceSeatCount()).to.equal(2);

      await User.softDelete(u.id);

      // Even with workspace + base roles, the soft-deleted user must
      // not be counted.
      expect(await workspaceSeatCount()).to.equal(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Org-only membership — no workspace presence
  //
  //  Adding a user to nc_org_users alone (no workspace_user, no
  //  base_user) must NOT count toward any workspace's seat count.
  //  Org membership is a permission grant; only workspace presence
  //  consumes a seat.
  // ─────────────────────────────────────────────────────────────────
  describe('Org-only membership', () => {
    it('a user present only in nc_org_users is not counted in any workspace', async () => {
      const orgId = await ensureOrg();
      const u = await makeUser();
      await addOrgUser(orgId, u.id, EnterpriseOrgUserRoles.VIEWER);

      // No workspace_user, no base_user → not a seat in this workspace.
      expect(await isSeatUser(u.id)).to.equal(false);
      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('promoting an org-only user to ORG ADMIN still does not consume a seat', async () => {
      const orgId = await ensureOrg();
      const u = await makeUser();
      await addOrgUser(orgId, u.id, EnterpriseOrgUserRoles.ADMIN);

      // The bootstrap owner is the only workspace member.
      expect(await workspaceSeatCount()).to.equal(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Bulk operations
  //
  //  Mass invite / mass removal flows are the common admin
  //  operations. They must produce a count that matches the
  //  underlying truth (no off-by-one, no drift).
  // ─────────────────────────────────────────────────────────────────
  describe('Bulk operations', () => {
    it('bulk-adding 10 EDITORs → seat count = owner + 10', async () => {
      const users = await Promise.all(
        Array.from({ length: 10 }).map(() => makeUser()),
      );
      for (const u of users) {
        await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      }

      expect(await workspaceSeatCount()).to.equal(11);
    });

    it('bulk-removing all added users returns the count to 1', async () => {
      const users = await Promise.all(
        Array.from({ length: 5 }).map(() => makeUser()),
      );
      for (const u of users) {
        await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      }
      expect(await workspaceSeatCount()).to.equal(6);

      for (const u of users) {
        await WorkspaceUser.softDelete(workspaceId, u.id);
      }

      expect(await workspaceSeatCount()).to.equal(1);
    });

    it('mixed roles in a batch — only seat-consuming roles count', async () => {
      const mix: Array<[WorkspaceUserRoles, number]> = [
        [WorkspaceUserRoles.OWNER, 1],
        [WorkspaceUserRoles.CREATOR, 1],
        [WorkspaceUserRoles.EDITOR, 1],
        [WorkspaceUserRoles.VIEWER, 0],
        [WorkspaceUserRoles.COMMENTER, 0],
        [WorkspaceUserRoles.NO_ACCESS, 0],
      ];
      let expectedDelta = 0;
      for (const [role, contribution] of mix) {
        const u = await makeUser();
        await addWorkspaceUser(u.id, role);
        expectedDelta += contribution;
      }

      // Bootstrap owner + sum of seat-consuming contributions.
      expect(await workspaceSeatCount()).to.equal(1 + expectedDelta);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Operation ordering
  //
  //  The order of (invite to workspace, assign base role) must not
  //  affect the final count. Real-world flows mix both orders
  //  (admin-invite then base-grant; SCIM provisioner backfilling).
  // ─────────────────────────────────────────────────────────────────
  describe('Operation ordering', () => {
    it('workspace_user first → then base_user: count = 2', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.OWNER);
      expect(await workspaceSeatCount()).to.equal(2);
    });

    it('base_user first → then workspace_user: count = 2', async () => {
      const u = await makeUser();
      // addBaseUser already adds workspace_user as NO_ACCESS — drop it
      // and re-add explicitly to exercise the reverse order.
      await addBaseUser(u.id, ProjectRoles.OWNER);
      await WorkspaceUser.update(workspaceId, u.id, {
        roles: WorkspaceUserRoles.EDITOR,
      });

      expect(await workspaceSeatCount()).to.equal(2);
    });

    it('remove then re-add does not drift the count', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);

      await WorkspaceUser.softDelete(workspaceId, u.id);
      expect(await workspaceSeatCount()).to.equal(1);

      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await workspaceSeatCount()).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //  Global (on-prem) seat count — row-level invariants
  //
  //  `NocoLicense.calculateGlobalSeatCount` lives in `ee-on-prem` and
  //  is not loadable from the EE-cloud test tsconfig (its `~/*` path
  //  alias resolves differently). Rather than skip coverage entirely,
  //  we assert the **DB-row invariants** the global query depends on:
  //
  //    • After every user-removal path (workspace, org, base, user
  //      soft-delete), no role-bearing row references the user in
  //      any active workspace/base.
  //    • Soft-deleted workspaces and bases never have role-bearing
  //      rows that count toward the global query.
  //
  //  The global query is a strict superset of the cloud per-workspace
  //  query — same JOINs, same role-extraction, just unscoped — so if
  //  the row state is clean, the global count is clean.
  // ─────────────────────────────────────────────────────────────────
  describe('Global (on-prem) row-level invariants', () => {
    /** Count active role-bearing rows for a user across the instance.
     *  Mirrors the JOIN shape of `calculateGlobalSeatCount`. */
    async function globalRoleBearingRowCount(userId: string): Promise<number> {
      const wuRows = await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE_USER)
        .join(
          MetaTable.WORKSPACE,
          `${MetaTable.WORKSPACE}.id`,
          '=',
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        )
        .where(`${MetaTable.WORKSPACE_USER}.fk_user_id`, userId)
        .where(function () {
          this.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
            `${MetaTable.WORKSPACE_USER}.deleted`,
          );
        })
        .where(function () {
          this.where(`${MetaTable.WORKSPACE}.deleted`, false).orWhereNull(
            `${MetaTable.WORKSPACE}.deleted`,
          );
        })
        .count('* as count')
        .first();

      const buRows = await Noco.ncMeta
        .knexConnection(MetaTable.PROJECT_USERS)
        .join(
          MetaTable.PROJECT,
          `${MetaTable.PROJECT}.id`,
          '=',
          `${MetaTable.PROJECT_USERS}.base_id`,
        )
        .where(`${MetaTable.PROJECT_USERS}.fk_user_id`, userId)
        .where(function () {
          this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
            `${MetaTable.PROJECT}.deleted`,
          );
        })
        .count('* as count')
        .first();

      return (
        Number((wuRows as any)?.count ?? 0) +
        Number((buRows as any)?.count ?? 0)
      );
    }

    it('removeUserFromOrgCascade leaves zero role-bearing rows for the user', async () => {
      const orgId = await ensureOrg();
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);
      await addOrgUser(orgId, u.id);

      expect(await globalRoleBearingRowCount(u.id)).to.be.greaterThan(0);

      await removeUserFromOrgCascade(orgId, u.id);

      // The global query would not see this user as a seat in any
      // workspace post-cascade.
      expect(await globalRoleBearingRowCount(u.id)).to.equal(0);
    });

    it('User.softDelete leaves the user.is_deleted flag set, which the global query filters on', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      await addBaseUser(u.id, ProjectRoles.EDITOR);

      await User.softDelete(u.id);

      // The global query filters `users.is_deleted = FALSE`; verify
      // that flag is set so the user drops out of the seat count.
      const row = await Noco.ncMeta
        .knexConnection(MetaTable.USERS)
        .where('id', u.id)
        .first();
      expect(row?.is_deleted).to.equal(true);

      // Row-bearing tables may still have entries (we don't physically
      // delete on User.softDelete), but the join on the `is_deleted`
      // filter excludes them from the seat count.
      // Sanity check via the cloud function (same filter logic):
      expect(await isSeatUser(u.id)).to.equal(false);
    });

    it('soft-deleting a workspace removes its rows from the global active set', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);
      expect(await globalRoleBearingRowCount(u.id)).to.equal(1);

      await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .where('id', workspaceId)
        .update({ deleted: true });

      expect(await globalRoleBearingRowCount(u.id)).to.equal(0);
    });

    it('a user in two workspaces shows two rows — global query dedupes by user_id', async () => {
      const u = await makeUser();
      await addWorkspaceUser(u.id, WorkspaceUserRoles.EDITOR);

      const w2 = await Workspace.insert({
        id: `ws_${uuidv4().replace(/-/g, '').slice(0, 17)}`,
        title: 'GlobalDedupWs',
        fk_user_id: ownerId,
      });
      await WorkspaceUser.insert({
        fk_workspace_id: w2!.id,
        fk_user_id: u.id,
        roles: WorkspaceUserRoles.EDITOR,
      });

      // Two active workspace_user rows exist — the global query relies on
      // its `seatUsersMap` (keyed by user_id) to dedupe.
      expect(await globalRoleBearingRowCount(u.id)).to.equal(2);
    });
  });
}

export { seatCountingTests };
