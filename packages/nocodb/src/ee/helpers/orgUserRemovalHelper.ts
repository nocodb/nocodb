import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { Knex } from 'knex';
import Base from '~/models/Base';
import BaseUser from '~/models/BaseUser';
import { OrgUser, Permission } from '~/models';
import WorkspaceUser from '~/ee/models/WorkspaceUser';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheScope,
  MetaTable,
  PrincipalType,
  ResourceType,
} from '~/utils/globals';
import {
  handleOrphanBases,
  handleOrphanWorkspace,
} from '~/ee/utils/orphanBaseHandler';
import Noco from '~/Noco';

/**
 * Batch soft-delete all team assignments for a user and invalidate cache.
 *
 * Uses a single UPDATE for the DB write, then loops over the affected
 * teams for cache invalidation (in-memory, no extra DB round-trips).
 *
 * Each team carries its workspace_id so cache keys are prefixed correctly
 * (NocoCache keys include workspace_id in the prefix).
 */
async function batchRemoveUserFromTeams(
  teams: { id: string; fk_workspace_id: string | null }[],
  userId: string,
  ncMeta: any,
) {
  if (!teams.length) return;

  const teamIds = teams.map((t) => t.id);

  // Single DB update — soft-delete all matching assignments in one query
  await ncMeta
    .knexConnection(MetaTable.PRINCIPAL_ASSIGNMENTS)
    .where('principal_type', PrincipalType.USER)
    .where('principal_ref_id', userId)
    .where('resource_type', ResourceType.TEAM)
    .whereIn('resource_id', teamIds)
    .where(function (this: Knex.QueryBuilder) {
      this.where('deleted', false).orWhereNull('deleted');
    })
    .update({ deleted: true });

  // Cache invalidation per team — context must match the prefix used when caching
  for (const team of teams) {
    const ctx = { workspace_id: team.fk_workspace_id, base_id: null };
    await NocoCache.deepDel(
      ctx,
      `${CacheScope.PRINCIPAL_ASSIGNMENT}:${ResourceType.TEAM}:${team.id}:${PrincipalType.USER}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.del(
      ctx,
      `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${ResourceType.TEAM}:${team.id}`,
    );
  }
}

/**
 * Transactionally remove a user from an org and cascade to all
 * workspaces, workspace teams, and org-level teams.
 *
 * Shared between cloud and on-prem org-users services.
 */
export async function removeUserFromOrgCascade(
  orgId: string,
  userId: string,
  ncMeta = Noco.ncMeta,
): Promise<void> {
  // Find the org admin to transfer ownership if needed
  const orgAdmin = await ncMeta
    .knexConnection(MetaTable.ORG_USERS)
    .where('fk_org_id', orgId)
    .where('roles', EnterpriseOrgUserRoles.ADMIN)
    .whereNot('fk_user_id', userId)
    .where(function (this: Knex.QueryBuilder) {
      this.where('deleted', false).orWhereNull('deleted');
    })
    .first();

  const transaction = await ncMeta.startTransaction();

  // Post-commit cache invalidations — collected during the transaction,
  // executed only after a successful commit. Mirrors the pattern in
  // `cleanupWorkspaceUser` so a rollback never leaves cache out of sync.
  const cacheTransaction: (() => Promise<any>)[] = [];

  try {
    // Soft-delete from org
    await OrgUser.softDelete(orgId, userId, transaction);

    // Remove from all workspaces in this org
    const orgWorkspaces = await transaction
      .knexConnection(MetaTable.WORKSPACE)
      .where('fk_org_id', orgId)
      .where(function (this: Knex.QueryBuilder) {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('id');

    for (const ws of orgWorkspaces) {
      // Transfer workspace ownership to org admin if user is sole owner
      if (orgAdmin) {
        await handleOrphanWorkspace(
          ws.id,
          userId,
          orgAdmin.fk_user_id,
          transaction,
        );
      }

      await WorkspaceUser.softDelete(ws.id, userId, transaction);

      // Hard-delete direct base memberships across all bases in the
      // workspace (active + soft-deleted + snapshot). Without this, the
      // orphan nc_base_users_v2 rows keep the user counted by the on-prem
      // seat calculation (NocoLicense.calculateGlobalSeatCount). Mirror
      // the per-base cleanup that `cleanupWorkspaceUser` performs so
      // permission subjects and per-base caches are also reaped.
      const wsBases = await Base.listByWorkspace(
        ws.id,
        { includeDeleted: true, includeSnapshot: true },
        transaction,
      );
      for (const base of wsBases) {
        const baseCtx = { workspace_id: ws.id, base_id: base.id };

        await BaseUser.delete(baseCtx, base.id, userId, transaction);

        await Permission.removeSubjectBase(
          baseCtx,
          { type: 'user', id: userId },
          transaction,
        );

        cacheTransaction.push(() =>
          NocoCache.del(
            baseCtx,
            `${CacheScope.BASE_USER}:${base.id}:${userId}`,
          ),
        );
        cacheTransaction.push(() => Permission.clearBaseCache(baseCtx));
      }

      cacheTransaction.push(() =>
        NocoCache.del(
          { workspace_id: ws.id, base_id: null },
          `${CacheScope.WORKSPACE_USER}:${ws.id}:${userId}`,
        ),
      );

      // Reassign orphan bases to the next workspace owner
      await handleOrphanBases(ws.id, userId, transaction);
    }

    // Batch-remove from all workspace teams + org teams in two queries
    const wsIds = orgWorkspaces.map((ws) => ws.id);

    // Collect workspace team IDs in one query
    const wsTeamRows = wsIds.length
      ? await transaction
          .knexConnection(MetaTable.TEAMS)
          .whereIn('fk_workspace_id', wsIds)
          .where(function (this: Knex.QueryBuilder) {
            this.where('deleted', false).orWhereNull('deleted');
          })
          .select('id', 'fk_workspace_id')
      : [];

    // Collect org-level team IDs in one query
    const orgTeamRows = await transaction
      .knexConnection(MetaTable.TEAMS)
      .where('fk_org_id', orgId)
      .whereNull('fk_workspace_id')
      .where(function (this: Knex.QueryBuilder) {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('id', 'fk_workspace_id');

    const allTeams = [...wsTeamRows, ...orgTeamRows];

    await batchRemoveUserFromTeams(allTeams, userId, transaction);

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }

  // Execute deferred cache invalidations now that the transaction has
  // committed. Failures here don't roll back DB state — log and continue
  // so a flaky cache backend can't block the user-removal flow.
  await Promise.all(cacheTransaction.map((fn) => fn().catch(() => undefined)));
}
