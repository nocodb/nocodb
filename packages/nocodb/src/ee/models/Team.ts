import { PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

// Todo: handle cache key when adding support for org level teams
export default class Team {
  id: string;
  title: string;
  meta?: Record<string, any> | string;
  fk_org_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  deleted: boolean; // Soft delete flag
  created_at?: string;
  updated_at?: string;

  constructor(data: Team) {
    Object.assign(this, data);
  }

  protected static castType(team: Team): Team {
    return team && new Team(prepareForResponse(team, 'meta'));
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
    ]);

    // Set deleted to false by default
    insertObj.deleted = false;

    // Prepare meta for database storage
    const preparedTeam = prepareForDb(insertObj, 'meta');

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      preparedTeam,
      true,
    );

    // Get the full record with timestamps
    const fullTeam = await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      id,
    );

    await NocoCache.set(context, `${CacheScope.TEAM}:${id}`, fullTeam);

    // Use the same cache key logic as list method for consistency
    const baseCacheKey = context.workspace_id ?? context.org_id;
    const cacheKey = baseCacheKey; // New teams are always active (not deleted)

    await NocoCache.appendToList(
      context,
      CacheScope.TEAM,
      [cacheKey],
      `${CacheScope.TEAM}:${id}`,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      1,
    );

    return this.castType(fullTeam);
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
      const teams = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          condition: {
            id: teamId,
          },
          xcCondition: {
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
          },
        },
      );

      teamData = teams.length > 0 ? teams[0] : null;

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
    ]);

    // Prepare meta for database storage
    const preparedTeam = prepareForDb(updateObj, 'meta');

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

    // Get the full updated record with timestamps
    const fullTeam = await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.TEAMS,
      teamId,
    );

    await NocoCache.set(context, `${CacheScope.TEAM}:${teamId}`, fullTeam);

    await NocoCache.deepDel(
      context,
      CacheScope.TEAM,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return this.castType(fullTeam);
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
      CacheScope.TEAM,
      CacheDelDirection.CHILD_TO_PARENT,
    );

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
      CacheScope.TEAM,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      -1,
    );
  }
}
