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

const logger = new Logger('TeamUser');

export default class TeamUser {
  fk_team_id: string;
  fk_user_id: string;
  roles: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: TeamUser) {
    Object.assign(this, data);
  }

  protected static castType(teamUser: TeamUser): TeamUser {
    return teamUser && new TeamUser(teamUser);
  }

  public static async insert(
    context: NcContext,
    teamUser: Partial<TeamUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(teamUser, [
      'fk_team_id',
      'fk_user_id',
      'roles',
    ]);

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAM_USERS,
      insertObj,
      true,
    );

    await NocoCache.set(
      context,
      `${CacheScope.TEAM_USER}:${insertObj.fk_team_id}:${insertObj.fk_user_id}`,
      insertObj,
    );

    await NocoCache.appendToList(
      context,
      CacheScope.TEAM_USER,
      [insertObj.fk_team_id],
      `${CacheScope.TEAM_USER}:${insertObj.fk_team_id}:${insertObj.fk_user_id}`,
    );

    return this.get(context, insertObj.fk_team_id, insertObj.fk_user_id, ncMeta);
  }

  public static async get(
    context: NcContext,
    teamId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TeamUser> {
    let teamUserData =
      teamId &&
      userId &&
      (await NocoCache.get(
        context,
        `${CacheScope.TEAM_USER}:${teamId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!teamUserData) {
      teamUserData = await ncMeta.metaGet(
        context.workspace_id,
        context.base_id,
        MetaTable.TEAM_USERS,
        { fk_team_id: teamId, fk_user_id: userId },
      );

      if (teamUserData) {
        await NocoCache.set(
          context,
          `${CacheScope.TEAM_USER}:${teamId}:${userId}`,
          teamUserData,
        );
      }
    }

    return this.castType(teamUserData);
  }

  public static async listByTeam(
    context: NcContext,
    teamId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TeamUser[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.TEAM_USER, [
      teamId,
    ]);

    let { list: teamUserList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !teamUserList.length) {
      teamUserList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.TEAM_USERS,
        {
          condition: { fk_team_id: teamId },
        },
      );

      await NocoCache.setList(
        context,
        CacheScope.TEAM_USER,
        [teamId],
        teamUserList,
      );
    }

    return teamUserList.map((teamUser) => this.castType(teamUser));
  }

  public static async listByUser(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TeamUser[]> {
    const teamUserList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAM_USERS,
      {
        condition: { fk_user_id: userId },
      },
    );

    return teamUserList.map((teamUser) => this.castType(teamUser));
  }

  public static async update(
    context: NcContext,
    teamId: string,
    userId: string,
    teamUser: Partial<TeamUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(teamUser, ['roles']);

    // get existing cache
    const key = `${CacheScope.TEAM_USER}:${teamId}:${userId}`;
    const existing = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);

    if (!existing) {
      NcError.notFound(`Team user not found`);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAM_USERS,
      updateObj,
      { fk_team_id: teamId, fk_user_id: userId },
    );

    await NocoCache.set(context, key, {
      ...existing,
      ...updateObj,
    });

    await NocoCache.deepDel(
      context,
      `${CacheScope.TEAM_USER}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return this.get(context, teamId, userId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    teamId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TEAM_USERS,
      { fk_team_id: teamId, fk_user_id: userId },
    );

    await NocoCache.del(context, `${CacheScope.TEAM_USER}:${teamId}:${userId}`);

    await NocoCache.deepDel(
      context,
      `${CacheScope.TEAM_USER}:${teamId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }
} 