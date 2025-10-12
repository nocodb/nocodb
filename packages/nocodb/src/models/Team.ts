import { Logger } from '@nestjs/common';
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

export default class Team {
  id: string;
  title: string;
  meta?: Record<string, any> | string;
  fk_org_id?: string;
  fk_workspace_id?: string;
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
    ]);

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

    await NocoCache.appendToList(
      context,
      CacheScope.TEAM,
      [context.workspace_id ?? context.org_id],
      `${CacheScope.TEAM}:${id}`,
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
      teamData = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        teamId,
      );

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
    }: {
      fk_org_id?: string;
      fk_workspace_id?: string;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<Team[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.TEAM, [
      context.workspace_id ?? context.org_id,
    ]);

    let { list: teamList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !teamList.length) {
      teamList = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.TEAMS,
        {
          condition: {
            ...(fk_org_id && { fk_org_id }),
            ...(fk_workspace_id && { fk_workspace_id }),
          },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.TEAM,
        [context.workspace_id ?? context.org_id],
        teamList,
      );
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

  public static async delete(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(RootScopes.ROOT, RootScopes.ROOT, MetaTable.TEAMS, {
      id: teamId,
    });

    await NocoCache.del(context, `${CacheScope.TEAM}:${teamId}`);

    await NocoCache.deepDel(
      context,
      CacheScope.TEAM,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }
}
