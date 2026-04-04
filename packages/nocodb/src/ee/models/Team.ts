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

// Cache key uses context.workspace_id ?? context.org_id — supports both scopes
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

    // Validate depth limit (max 3 levels)
    if (insertObj.depth !== undefined && insertObj.depth > 3) {
      throw NcError.badRequest(
        'Maximum team hierarchy depth of 3 levels exceeded',
      );
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      prepareForDb(insertObj, ['meta', 'scim_meta']),
    );

    // Use workspace or org scope for cache key
    const baseCacheKey = context.workspace_id ?? context.org_id;

    if (context.workspace_id) {
      await NocoCache.incrHashField(
        'root',
        `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
        PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
        1,
      );
    }

    return this.get(context, id, ncMeta).then(async (team) => {
      await NocoCache.appendToList(
        'root',
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
        'root',
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
        await NocoCache.set('root', `${CacheScope.TEAM}:${teamId}`, teamData);
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

    const cachedList = await NocoCache.getList('root', CacheScope.TEAM, [
      cacheKey,
    ]);

    let { list: teamList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !teamList.length) {
      const andConditions: any[] = [];

      if (fk_org_id) andConditions.push({ fk_org_id: { eq: fk_org_id } });
      if (fk_workspace_id)
        andConditions.push({ fk_workspace_id: { eq: fk_workspace_id } });

      if (!include_deleted) {
        // Default: exclude soft-deleted records
        andConditions.push({
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        });
      }

      const xcCondition =
        andConditions.length > 0 ? { _and: andConditions } : {};

      teamList = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          ...(andConditions.length > 0 && { xcCondition }),
        },
      );

      await NocoCache.setList('root', CacheScope.TEAM, [cacheKey], teamList);
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

    const existing = await this.get(context, teamId, ncMeta);

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
      'root',
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
      'root',
      `${CacheScope.TEAM}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Clear all dependent caches when team is soft deleted
    await this.clearDependentCaches(context, teamId, ncMeta);

    if (context.workspace_id) {
      await NocoCache.incrHashField(
        'root',
        `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
        PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
        -1,
      );
    }
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

    await NocoCache.del('root', `${CacheScope.TEAM}:${teamId}`);

    // Invalidate both active and deleted cache lists
    const baseCacheKey = context.workspace_id ?? context.org_id;
    await NocoCache.del('root', `${CacheScope.TEAM}:${baseCacheKey}`);
    await NocoCache.del('root', `${CacheScope.TEAM}:${baseCacheKey}:deleted`);

    await NocoCache.deepDel(
      'root',
      `${CacheScope.TEAM}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Clear all dependent caches when team is restored
    await this.clearDependentCaches(context, teamId, ncMeta);

    if (context.workspace_id) {
      await NocoCache.incrHashField(
        'root',
        `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
        PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
        1,
      );
    }
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

    await NocoCache.del('root', `${CacheScope.TEAM}:${teamId}`);

    // Invalidate both active and deleted cache lists
    const baseCacheKey = context.workspace_id ?? context.org_id;
    await NocoCache.del('root', `${CacheScope.TEAM}:${baseCacheKey}`);
    await NocoCache.del('root', `${CacheScope.TEAM}:${baseCacheKey}:deleted`);

    await NocoCache.deepDel(
      'root',
      `${CacheScope.TEAM}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    if (context.workspace_id) {
      await NocoCache.incrHashField(
        'root',
        `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
        PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
        -1,
      );
    }
  }

  // ── Hierarchy methods ──────────────────────────────────────────────

  /**
   * Get all descendant teams using materialized path.
   * Excludes soft-deleted teams.
   */
  public static async getDescendants(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team[]> {
    const team = await this.get(context, teamId, ncMeta);
    if (!team?.path) return [];

    const descendants = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        xcCondition: {
          _and: [
            { fk_workspace_id: { eq: team.fk_workspace_id } },
            { path: { like: `${team.path}/%` } },
            { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
          ],
        },
      },
    );

    return descendants.map((t) => this.castType(t));
  }

  /**
   * Batch-get multiple teams by IDs in a single query.
   * Falls back to cache for each ID first, then fetches remaining from DB.
   */
  public static async getByIds(
    context: NcContext,
    teamIds: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, Team>> {
    const result = new Map<string, Team>();
    if (!teamIds.length) return result;

    const uniqueIds = [...new Set(teamIds)];
    const uncachedIds: string[] = [];

    // Check cache first for each ID
    for (const id of uniqueIds) {
      const cached = await NocoCache.get(
        'root',
        `${CacheScope.TEAM}:${id}`,
        CacheGetType.TYPE_OBJECT,
      );
      if (cached) {
        result.set(id, this.castType(cached));
      } else {
        uncachedIds.push(id);
      }
    }

    // Batch-fetch uncached from DB
    if (uncachedIds.length) {
      const rows = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          xcCondition: {
            _and: [
              { fk_workspace_id: { eq: context.workspace_id } },
              { id: { in: uncachedIds } },
              { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
            ],
          },
        },
      );

      const baseCacheKey = context.workspace_id ?? context.org_id;

      for (const row of rows) {
        await NocoCache.set('root', `${CacheScope.TEAM}:${row.id}`, row);
        await NocoCache.appendToList(
          'root',
          CacheScope.TEAM,
          [baseCacheKey],
          `${CacheScope.TEAM}:${row.id}`,
        );
        result.set(row.id, this.castType(row));
      }
    }

    return result;
  }

  /**
   * Get descendants for multiple teams in a single query using materialized paths.
   * Returns a map of teamId → descendant teams.
   */
  public static async getDescendantsForMultiple(
    context: NcContext,
    teams: { id: string; path: string; fk_workspace_id: string }[],
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, Team[]>> {
    const result = new Map<string, Team[]>();
    if (!teams.length) return result;

    for (const team of teams) {
      result.set(team.id, []);
    }

    const workspaceId = teams[0].fk_workspace_id;

    const descendants = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        xcCondition: {
          _and: [
            { fk_workspace_id: { eq: workspaceId } },
            { _or: teams.map((t) => ({ path: { like: `${t.path}/%` } })) },
            { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
          ],
        },
      },
    );

    // O(1) lookup for input teams by path
    const teamByPath = new Map(teams.map((t) => [t.path, t]));

    // Reference cache: descendant path → closest ancestor team
    const parentRef = new Map<string, { id: string } | null>();

    const resolveParent = (path: string): { id: string } | null => {
      if (parentRef.has(path)) return parentRef.get(path)!;

      let p = path.lastIndexOf('/');
      while (p > 0) {
        const parentPath = path.substring(0, p);

        // Check if it's one of our input teams first (closest ancestor wins)
        const match = teamByPath.get(parentPath);
        if (match) {
          parentRef.set(path, match);
          return match;
        }

        // Check cache for non-input intermediate paths
        if (parentRef.has(parentPath)) {
          const cached = parentRef.get(parentPath)!;
          parentRef.set(path, cached);
          return cached;
        }

        p = path.lastIndexOf('/', p - 1);
      }

      parentRef.set(path, null);
      return null;
    };

    for (const desc of descendants) {
      if (!desc.path) continue;
      const parent = resolveParent(desc.path);
      if (parent) {
        const siblings = result.get(parent.id);
        if (siblings) {
          siblings.push(this.castType(desc));
        }
      }
    }

    return result;
  }

  /**
   * Get all ancestor teams by parsing the materialized path.
   * Excludes soft-deleted teams.
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

    // Batch load all ancestors in a single query instead of N queries
    const ancestors = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      {
        xcCondition: {
          _and: [
            { id: { in: ancestorIds } },
            { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
          ],
        },
      },
    );

    // Maintain order based on path (root first)
    const ancestorMap = new Map(ancestors.map((a) => [a.id, a]));
    const result: Team[] = [];
    for (const id of ancestorIds) {
      const ancestor = ancestorMap.get(id);
      if (ancestor) {
        result.push(this.castType(ancestor));
      }
    }

    return result;
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
        xcCondition: {
          _and: [
            { fk_parent_team_id: { eq: teamId } },
            { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
          ],
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

    // Validate team is not soft-deleted
    if (team.deleted) {
      throw NcError.badRequest('Cannot reparent a deleted team');
    }

    // Compute new path and depth
    let newPath: string;
    let newDepth: number;

    if (newParentId) {
      const parent = await this.get(context, newParentId, ncMeta);
      if (!parent) {
        NcError.notFound(`Parent team with id ${newParentId} not found`);
      }

      // Validate parent is not soft-deleted
      if (parent.deleted) {
        throw NcError.badRequest('Cannot move team under a deleted parent');
      }

      // Validate same workspace
      if (team.fk_workspace_id !== parent.fk_workspace_id) {
        throw NcError.badRequest('Teams must be in the same workspace');
      }

      newPath = `${parent.path}/${teamId}`;
      newDepth = parent.depth + 1;

      // Validate depth limit
      if (newDepth > 3) {
        throw NcError.badRequest(
          'Maximum team hierarchy depth of 3 levels exceeded',
        );
      }
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
      const depthDiff = newDepth - team.depth;
      const descendants = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          xcCondition: {
            _and: [
              { path: { like: `${oldPath}/%` } },
              { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
            ],
          },
        },
      );

      for (const desc of descendants) {
        const updatedPath = newPath + desc.path.slice(oldPath.length);
        const updatedDepth = desc.depth + depthDiff;
        await ncMeta.metaUpdate(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.TEAMS,
          {
            path: updatedPath,
            depth: updatedDepth,
          },
          { id: desc.id },
        );
        await NocoCache.update('root', `${CacheScope.TEAM}:${desc.id}`, {
          path: updatedPath,
          depth: updatedDepth,
        });
      }
    }

    // Clear caches for this team and its list
    await NocoCache.del('root', `${CacheScope.TEAM}:${teamId}`);
    const baseCacheKey = context.workspace_id ?? context.org_id;
    await NocoCache.del('root', `${CacheScope.TEAM}:${baseCacheKey}`);

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
          await NocoCache.del('root', `${CacheScope.TEAM}:${ancestorId}`);
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
        xcCondition: {
          _and: [
            { fk_workspace_id: { eq: workspaceId } },
            { scim_external_id: { eq: scimExternalId } },
            { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
          ],
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
