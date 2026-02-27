import { PlanLimitTypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  PrincipalType,
  ResourceType,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import Base from '~/models/Base';

const logger = new Logger('Team');

// Todo: handle cache key when adding support for org level teams
export default class Team {
  id: string;
  title: string;
  meta?: Record<string, any> | string;
  fk_org_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  deleted: boolean; // Soft delete flag
  fk_parent_team_id?: string | null;
  depth: number;
  path?: string;
  created_at?: string;
  updated_at?: string;
  // SCIM fields
  scim_external_id?: string;
  scim_managed?: boolean;
  scim_display_name?: string;
  scim_meta?: Record<string, any> | string;

  constructor(data: Team) {
    Object.assign(this, data);
  }

  protected static castType(team: Team): Team {
    if (!team) return team;
    const prepared = prepareForResponse(team, 'meta');
    return new Team(prepareForResponse(prepared, 'scim_meta'));
  }

  public static async insert(
    context: NcContext,
    team: Partial<Team>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(team, [
      'id',
      'title',
      'meta',
      'fk_org_id',
      'fk_workspace_id',
      'created_by',
      'fk_parent_team_id',
      'depth',
      'path',
      'scim_external_id',
      'scim_managed',
      'scim_display_name',
      'scim_meta',
    ]);

    // Set deleted to false by default
    insertObj.deleted = false;

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      prepareForDb(insertObj, ['meta', 'scim_meta']),
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      1,
    );

    // get() → appendToList() pattern (same as Dashboard.insert)
    const baseCacheKey = context.workspace_id ?? context.org_id;

    return this.get(context, id, ncMeta).then(async (team) => {
      await NocoCache.appendToList(
        context,
        CacheScope.TEAM,
        [baseCacheKey],
        `${CacheScope.TEAM}:${id}`,
      );
      return team;
    });
  }

  public static async get(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team> {
    let teamData =
      teamId &&
      (await NocoCache.get(
        context,
        `${CacheScope.TEAM}:${teamId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!teamData) {
      teamData = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        { id: teamId },
      );

      // Filter out soft-deleted teams
      if (teamData && teamData.deleted === true) {
        teamData = null;
      }

      if (teamData) {
        await NocoCache.set(context, `${CacheScope.TEAM}:${teamId}`, teamData);
      }
    }

    return this.castType(teamData);
  }

  public static async list(
    context: NcContext,
    {
      fk_org_id,
      fk_workspace_id,
      include_deleted = false,
    }: {
      fk_org_id?: string;
      fk_workspace_id?: string;
      include_deleted?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<Team[]> {
    // Include include_deleted in cache key to prevent cache conflicts
    const baseCacheKey = context.workspace_id ?? context.org_id;
    const cacheKey = include_deleted ? `${baseCacheKey}:deleted` : baseCacheKey;

    const cachedList = await NocoCache.getList(context, CacheScope.TEAM, [
      cacheKey,
    ]);

    let { list: teamList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !teamList.length) {
      const condition: any = {
        ...(fk_org_id && { fk_org_id }),
        ...(fk_workspace_id && { fk_workspace_id }),
      };

      let xcCondition: any = {};

      if (!include_deleted) {
        // Default: exclude soft-deleted records
        xcCondition = {
          _or: [
            {
              deleted: {
                eq: false,
              },
            },
            {
              deleted: {
                eq: null,
              },
            },
          ],
        };
      }

      teamList = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          condition,
          ...(Object.keys(xcCondition).length > 0 && { xcCondition }),
        },
      );

      await NocoCache.setList(context, CacheScope.TEAM, [cacheKey], teamList);
    }

    return teamList.map((team) => this.castType(team));
  }

  public static async update(
    context: NcContext,
    teamId: string,
    team: Partial<Team>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(team, [
      'title',
      'meta',
      'fk_org_id',
      'fk_workspace_id',
      'fk_parent_team_id',
      'depth',
      'path',
      'scim_external_id',
      'scim_managed',
      'scim_display_name',
      'scim_meta',
    ]);

    // Prepare meta for database storage
    let preparedTeam = prepareForDb(updateObj, 'meta');
    preparedTeam = prepareForDb(preparedTeam, 'scim_meta');

    // get existing cache
    const key = `${CacheScope.TEAM}:${teamId}`;
    const existing = await NocoCache.get(
      context,
      key,
      CacheGetType.TYPE_OBJECT,
    );

    if (!existing) {
      NcError.notFound(`Team with id ${teamId} not found`);
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      preparedTeam,
      { id: teamId },
    );

    await NocoCache.update(
      context,
      `${CacheScope.TEAM}:${teamId}`,
      preparedTeam,
    );

    // Clear all dependent caches when team is updated
    await this.clearDependentCaches(context, teamId, ncMeta);

    return this.get(context, teamId, ncMeta);
  }

  public static async softDelete(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      { deleted: true },
      { id: teamId },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.TEAM}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Clear all dependent caches when team is soft deleted
    await this.clearDependentCaches(context, teamId, ncMeta);

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      -1,
    );
  }

  public static async delete(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Use soft delete by default
    return this.softDelete(context, teamId, ncMeta);
  }

  public static async restore(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      { deleted: false },
      { id: teamId },
    );

    await NocoCache.del(context, `${CacheScope.TEAM}:${teamId}`);

    // Invalidate both active and deleted cache lists
    const baseCacheKey = context.workspace_id ?? context.org_id;
    await NocoCache.del(context, `${CacheScope.TEAM}:${baseCacheKey}`);
    await NocoCache.del(context, `${CacheScope.TEAM}:${baseCacheKey}:deleted`);

    await NocoCache.deepDel(
      context,
      `${CacheScope.TEAM}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Clear all dependent caches when team is restored
    await this.clearDependentCaches(context, teamId, ncMeta);

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      1,
    );
  }

  public static async hardDelete(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Clear all dependent caches before hard deleting (since assignments will be deleted too)
    await this.clearDependentCaches(context, teamId, ncMeta);

    await ncMeta.metaDelete(RootScopes.ROOT, RootScopes.ROOT, MetaTable.TEAMS, {
      id: teamId,
    });

    await NocoCache.del(context, `${CacheScope.TEAM}:${teamId}`);

    // Invalidate both active and deleted cache lists
    const baseCacheKey = context.workspace_id ?? context.org_id;
    await NocoCache.del(context, `${CacheScope.TEAM}:${baseCacheKey}`);
    await NocoCache.del(context, `${CacheScope.TEAM}:${baseCacheKey}:deleted`);

    await NocoCache.deepDel(
      context,
      `${CacheScope.TEAM}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      -1,
    );
  }

  // ── Hierarchy methods ──────────────────────────────────────────────

  /**
   * Get all descendant teams using materialized path.
   */
  public static async getDescendants(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team[]> {
    const team = await this.get(context, teamId, ncMeta);
    if (!team?.path) return [];

    const allTeams = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    return allTeams
      .filter((t) => t.path?.startsWith(team.path + '/'))
      .map((t) => this.castType(t));
  }

  /**
   * Get all ancestor teams by parsing the materialized path.
   */
  public static async getAncestors(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team[]> {
    const team = await this.get(context, teamId, ncMeta);
    if (!team?.path) return [];

    // Parse path: "/rootId/parentId/thisId" → ["rootId", "parentId"]
    const parts = team.path.split('/').filter(Boolean);
    // Remove the last element (the team itself)
    const ancestorIds = parts.slice(0, -1);

    if (ancestorIds.length === 0) return [];

    const ancestors: Team[] = [];
    for (const id of ancestorIds) {
      const ancestor = await this.get(context, id, ncMeta);
      if (ancestor) ancestors.push(ancestor);
    }

    return ancestors;
  }

  /**
   * Get direct children of a team.
   */
  public static async getChildren(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team[]> {
    const children = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        condition: { fk_parent_team_id: teamId },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    return children.map((t) => this.castType(t));
  }

  /**
   * Build the full team tree for a workspace.
   * Returns root-level nodes with nested children arrays.
   */
  public static async getTree(
    context: NcContext,
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<(Team & { children: Team[] })[]> {
    const allTeams = await this.list(
      context,
      { fk_workspace_id: workspaceId },
      ncMeta,
    );

    // Build lookup map
    const teamMap = new Map<string, Team & { children: Team[] }>();
    for (const team of allTeams) {
      teamMap.set(team.id, { ...team, children: [] });
    }

    // Build tree
    const roots: (Team & { children: Team[] })[] = [];
    for (const node of teamMap.values()) {
      if (node.fk_parent_team_id && teamMap.has(node.fk_parent_team_id)) {
        teamMap.get(node.fk_parent_team_id).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Move a team to a new parent. Updates path and depth for the team
   * and all its descendants.
   */
  public static async reparent(
    context: NcContext,
    teamId: string,
    newParentId: string | null,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const team = await this.get(context, teamId, ncMeta);
    if (!team) {
      NcError.notFound(`Team with id ${teamId} not found`);
    }

    // Compute new path and depth
    let newPath: string;
    let newDepth: number;

    if (newParentId) {
      const parent = await this.get(context, newParentId, ncMeta);
      if (!parent) {
        NcError.notFound(`Parent team with id ${newParentId} not found`);
      }
      newPath = `${parent.path}/${teamId}`;
      newDepth = parent.depth + 1;
    } else {
      newPath = `/${teamId}`;
      newDepth = 0;
    }

    const oldPath = team.path;

    // Update the team itself
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        fk_parent_team_id: newParentId,
        depth: newDepth,
        path: newPath,
      },
      { id: teamId },
    );

    // Update all descendants — replace old path prefix with new path prefix
    if (oldPath) {
      const descendants = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          xcCondition: {
            _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
          },
        },
      );

      const descendantIds: string[] = [];
      for (const desc of descendants) {
        if (desc.path?.startsWith(oldPath + '/')) {
          const updatedPath = newPath + desc.path.slice(oldPath.length);
          const depthDiff = newDepth - team.depth;
          await ncMeta.metaUpdate(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.TEAMS,
            {
              path: updatedPath,
              depth: desc.depth + depthDiff,
            },
            { id: desc.id },
          );
          descendantIds.push(desc.id);
        }
      }

      // Clear individual caches for all updated descendants
      for (const descId of descendantIds) {
        await NocoCache.del(context, `${CacheScope.TEAM}:${descId}`);
      }
    }

    // Clear caches for this team and its list
    await NocoCache.del(context, `${CacheScope.TEAM}:${teamId}`);
    const baseCacheKey = context.workspace_id ?? context.org_id;
    await NocoCache.del(context, `${CacheScope.TEAM}:${baseCacheKey}`);

    // Clear dependent caches
    await this.clearDependentCaches(context, teamId, ncMeta);
  }

  /**
   * Check if ancestorId is an ancestor of descendantId using materialized path.
   * O(1) string prefix check.
   */
  public static async isAncestor(
    context: NcContext,
    ancestorId: string,
    descendantId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const ancestor = await this.get(context, ancestorId, ncMeta);
    const descendant = await this.get(context, descendantId, ncMeta);
    if (!ancestor?.path || !descendant?.path) return false;

    return descendant.path.startsWith(ancestor.path + '/');
  }

  /**
   * Clears all dependent caches when team-related changes occur
   * Mainly focuses on clearing BASE_USER list cache for bases where the team is assigned
   *
   * @param context - NocoDB context
   * @param teamId - Team ID
   * @param ncMeta - NocoDB meta instance
   */
  public static async clearDependentCaches(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    try {
      // Get all assignments where the team is the principal (team assigned to workspace/base)
      const teamPrincipalAssignments = await PrincipalAssignment.list(
        context,
        {
          principal_type: PrincipalType.TEAM,
          principal_ref_id: teamId,
        },
        ncMeta,
      );

      // Clear BASE_USER list cache for all affected bases
      for (const assignment of teamPrincipalAssignments) {
        if (assignment.resource_type === ResourceType.BASE) {
          // Clear BASE_USER cache for this specific base
          const baseContext: NcContext = {
            ...context,
            base_id: assignment.resource_id,
          };
          await NocoCache.deepDel(
            baseContext,
            `${CacheScope.BASE_USER}:${assignment.resource_id}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
        } else if (assignment.resource_type === ResourceType.WORKSPACE) {
          // Clear BASE_USER cache for all bases in this workspace
          try {
            const bases = await Base.list(assignment.resource_id, ncMeta);
            for (const base of bases) {
              const baseContext: NcContext = {
                ...context,
                base_id: base.id,
              };
              await NocoCache.deepDel(
                baseContext,
                `${CacheScope.BASE_USER}:${base.id}`,
                CacheDelDirection.CHILD_TO_PARENT,
              );
            }
          } catch (error) {
            // If Base.list fails, continue without clearing cache
          }
        }
      }
      // Also clear caches for ancestor teams (they may inherit roles from this team's branch)
      const team = await this.get(context, teamId, ncMeta);
      if (team?.path) {
        const parts = team.path.split('/').filter(Boolean);
        // Exclude the team itself
        const ancestorIds = parts.slice(0, -1);
        for (const ancestorId of ancestorIds) {
          await NocoCache.del(context, `${CacheScope.TEAM}:${ancestorId}`);
        }
      }
    } catch (error) {
      // Log error but don't throw - cache clearing should not break the operation
      logger.warn(
        `Error clearing dependent caches for team ${teamId}:`,
        error.message,
      );
    }
  }

  /**
   * Direct DB lookup by SCIM external ID using the indexed column.
   * Avoids loading all teams into memory for SCIM operations.
   */
  public static async getByScimExternalId(
    context: NcContext,
    workspaceId: string,
    scimExternalId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team | null> {
    const teams = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        condition: {
          fk_workspace_id: workspaceId,
          scim_external_id: scimExternalId,
        },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    if (!teams.length) return null;

    return this.castType(teams[0]);
  }

  /**
   * SQL-level paginated list for SCIM endpoints.
   * Filters scim_managed=true at the DB level with LIMIT/OFFSET.
   */
  public static async scimList(
    context: NcContext,
    {
      fk_workspace_id,
      offset = 0,
      limit = 100,
      filterDisplayName,
      filterExternalId,
      sortBy,
      sortAscending = true,
    }: {
      fk_workspace_id: string;
      offset?: number;
      limit?: number;
      filterDisplayName?: string;
      filterExternalId?: string;
      sortBy?: string;
      sortAscending?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<{ list: Team[]; totalResults: number }> {
    const baseQuery = () => {
      const qb = ncMeta
        .knex(MetaTable.TEAMS)
        .where('fk_workspace_id', fk_workspace_id)
        .where('scim_managed', true)
        .where(function () {
          this.where('deleted', false).orWhereNull('deleted');
        });

      if (filterDisplayName) {
        qb.where(function () {
          this.whereRaw('LOWER(scim_display_name) = ?', [
            filterDisplayName.toLowerCase(),
          ]).orWhereRaw('LOWER(title) = ?', [filterDisplayName.toLowerCase()]);
        });
      }

      if (filterExternalId) {
        qb.whereRaw('LOWER(scim_external_id) = ?', [
          filterExternalId.toLowerCase(),
        ]);
      }

      return qb;
    };

    // Count query
    const countResult = await baseQuery().count('* as count').first();
    const totalResults = Number(countResult?.count || 0);

    // Data query with pagination and sorting
    const dataQuery = baseQuery().select('*').offset(offset).limit(limit);

    if (sortBy) {
      const sortCol =
        sortBy === 'displayName'
          ? 'scim_display_name'
          : sortBy === 'externalId'
          ? 'scim_external_id'
          : 'scim_display_name';
      dataQuery.orderBy(sortCol, sortAscending ? 'asc' : 'desc');
    } else {
      dataQuery.orderBy('created_at', 'asc');
    }

    const rows = await dataQuery;
    const list = rows.map((row) => this.castType(row));

    return { list, totalResults };
  }
}
