import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('Team');

export default class Team {
  id: string;
  title: string;
  fk_org_id?: string;
  fk_workspace_id?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: Team) {
    Object.assign(this, data);
  }

  protected static castType(team: Team): Team {
    return team && new Team(team);
  }

  public static async insert(
    context: NcContext,
    team: Partial<Team>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(team, [
      'id',
      'title',
      'fk_org_id',
      'fk_workspace_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAMS,
      insertObj,
      true,
    );

    await NocoCache.set(`${CacheScope.TEAM}:${id}`, {
      id,
      ...insertObj,
    });

    await NocoCache.appendToList(
      CacheScope.TEAM,
      [context.workspace_id, context.base_id],
      `${CacheScope.TEAM}:${id}`,
    );

    return this.get(context, id, ncMeta);
  }

  public static async get(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Team> {
    let teamData =
      teamId &&
      (await NocoCache.get(
        `${CacheScope.TEAM}:${teamId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!teamData) {
      teamData = await ncMeta.metaGet(
        context.workspace_id,
        context.base_id,
        MetaTable.TEAMS,
        teamId,
      );

      if (teamData) {
        await NocoCache.set(
          `${CacheScope.TEAM}:${teamId}`,
          teamData,
        );
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
    const cachedList = await NocoCache.getList(CacheScope.TEAM, [
      context.workspace_id,
      context.base_id,
    ]);

    let { list: teamList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !teamList.length) {
      teamList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.TEAMS,
        {
          condition: {
            ...(fk_org_id && { fk_org_id }),
            ...(fk_workspace_id && { fk_workspace_id }),
          },
        },
      );

      await NocoCache.setList(
        CacheScope.TEAM,
        [context.workspace_id, context.base_id],
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
      'fk_org_id',
      'fk_workspace_id',
    ]);

    // get existing cache
    const key = `${CacheScope.TEAM}:${teamId}`;
    const existing = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    if (!existing) {
      NcError.notFound(`Team with id ${teamId} not found`);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAMS,
      updateObj,
      { id: teamId },
    );

    await NocoCache.set(`${CacheScope.TEAM}:${teamId}`, {
      ...existing,
      ...updateObj,
    });

    await NocoCache.deepDel(
      CacheScope.TEAM,
      CacheDelDirection.CHILD_TO_PARENT,
      [context.workspace_id, context.base_id],
    );

    return this.get(context, teamId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAMS,
      { id: teamId },
    );

    await NocoCache.del(`${CacheScope.TEAM}:${teamId}`);

    await NocoCache.deepDel(
      CacheScope.TEAM,
      CacheDelDirection.CHILD_TO_PARENT,
      [context.workspace_id, context.base_id],
    );
  }
} 