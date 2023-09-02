import { ProjectRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';

export default class WorkspaceUser {
  fk_workspace_id: string;
  fk_user_id: string;
  roles?: string;
  invite_token?: string;
  invite_accepted?: boolean;
  order?: number;

  constructor(data: WorkspaceUser) {
    Object.assign(this, data);
  }

  public static async insert(
    projectUser: Partial<
      WorkspaceUser & { created_at?: any; updated_at?: any }
    >,
    ncMeta = Noco.ncMeta,
  ) {
    const order = await ncMeta.metaGetNextOrder(MetaTable.WORKSPACE_USER, {
      fk_user_id: projectUser.fk_user_id,
    });
    const { fk_workspace_id, fk_user_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.WORKSPACE_USER,
      {
        fk_user_id: projectUser.fk_user_id,
        fk_workspace_id: projectUser.fk_workspace_id,
        roles: projectUser.roles,
        created_at: projectUser.created_at,
        updated_at: projectUser.updated_at,
        order: projectUser.order ?? order,
      },
      true,
    );

    return this.get(fk_workspace_id, fk_user_id, ncMeta);
  }

  static async get(workspaceId: string, userId: string, ncMeta = Noco.ncMeta) {
    let workspaceUser =
      workspaceId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!workspaceUser) {
      workspaceUser = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.WORKSPACE_USER,
        {
          fk_user_id: userId,
          fk_workspace_id: workspaceId,
        },
      );
      if (workspaceUser)
        await NocoCache.set(
          `${CacheScope.PROJECT_USER}:${workspaceId}:${userId}`,
          workspaceUser,
        );
    }
    return workspaceUser;
  }

  static async workspaceList(
    { fk_user_id }: { fk_user_id: any },
    ncMeta = Noco.ncMeta,
  ) {
    // todo: caching

    const queryBuilder = ncMeta
      .knex(MetaTable.WORKSPACE)
      .select(
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.description`,
        `${MetaTable.WORKSPACE}.meta`,
        `${MetaTable.WORKSPACE}.fk_user_id`,
        `${MetaTable.WORKSPACE}.deleted`,
        `${MetaTable.WORKSPACE}.deleted_at`,
        `${MetaTable.WORKSPACE}.status`,
        `${MetaTable.WORKSPACE}.message`,
        `${MetaTable.WORKSPACE}.plan`,
        `${MetaTable.WORKSPACE_USER}.order`,
        `${MetaTable.WORKSPACE_USER}.invite_token`,
        `${MetaTable.WORKSPACE_USER}.invite_accepted`,
        `${MetaTable.WORKSPACE_USER}.roles as roles`,
      );

    // todo : pagination
    // .offset(offset)
    // .limit(limit);

    // todo : search
    // if (query) {
    //   queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    // }

    queryBuilder.leftJoin(MetaTable.WORKSPACE_USER, function () {
      this.on(
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        '=',
        `${MetaTable.WORKSPACE}.id`,
      ).andOn(
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        '=',
        ncMeta.knex.raw('?', [fk_user_id]),
      );
    });

    queryBuilder.where(function () {
      this.where(
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        '=',
        ncMeta.knex.raw('?', [fk_user_id]),
      );

      this.orWhereIn(
        `${MetaTable.WORKSPACE}.id`,
        ncMeta
          .knex(MetaTable.PROJECT)
          .select('fk_workspace_id')
          .innerJoin(MetaTable.PROJECT_USERS, function () {
            this.on(
              `${MetaTable.PROJECT_USERS}.project_id`,
              '=',
              `${MetaTable.PROJECT}.id`,
            ).andOn(
              `${MetaTable.PROJECT_USERS}.fk_user_id`,
              '=',
              ncMeta.knex.raw('?', [fk_user_id]),
            );
          })
          .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.NO_ACCESS),
      );
    });

    queryBuilder.orderBy(`${MetaTable.WORKSPACE_USER}.order`, 'asc');

    const workspaceList = await queryBuilder;

    // parse meta json
    for (const workspace of workspaceList) {
      try {
        workspace.meta =
          typeof workspace.meta === 'string'
            ? JSON.parse(workspace.meta)
            : workspace.meta;
      } catch {
        workspace.meta = {};
      }
    }

    return workspaceList;
  }

  static async userList(
    { fk_workspace_id }: { fk_workspace_id: any },
    ncMeta = Noco.ncMeta,
  ) {
    // todo: caching

    const queryBuilder = ncMeta.knex(MetaTable.USERS).select(
      `${MetaTable.USERS}.id`,
      `${MetaTable.USERS}.email`,
      // `${MetaTable.USERS}.invite_token`,
      `${MetaTable.USERS}.roles as main_roles`,
      `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
      `${MetaTable.WORKSPACE_USER}.invite_token`,
      `${MetaTable.WORKSPACE_USER}.invite_accepted`,
      `${MetaTable.WORKSPACE_USER}.created_at`,
      `${MetaTable.WORKSPACE_USER}.roles as roles`,
    );
    // todo : pagination
    // .offset(offset)
    // .limit(limit);

    // todo : search
    // if (query) {
    //   queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    // }

    queryBuilder.innerJoin(MetaTable.WORKSPACE_USER, function () {
      this.on(
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        '=',
        `${MetaTable.USERS}.id`,
      ).andOn(
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        '=',
        ncMeta.knex.raw('?', [fk_workspace_id]),
      );
    });

    return await queryBuilder;
  }

  static async count({ workspaceId }: { workspaceId: any }) {
    const key = `${CacheScope.WORKSPACE}:${workspaceId}:count`;
    let count = await NocoCache.get(key, CacheGetType.TYPE_STRING);

    if (!count) {
      count = await Noco.ncMeta.metaCount(
        null,
        null,
        MetaTable.WORKSPACE_USER,
        {
          condition: {
            fk_workspace_id: workspaceId,
          },
          aggField: 'fk_workspace_id',
        },
      );

      await NocoCache.set(key, count);
    } else {
      count = parseInt(count);
    }

    return count;
  }

  static async update(
    workspaceId: any,
    userId: any,
    _updateData: Partial<WorkspaceUser>,
  ) {
    // get existing cache
    const key = `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    const updateData = extractProps(_updateData, [
      'roles',
      'deleted',
      'invite_token',
      'invite_accepted',
      'deleted',
      'deleted_at',
      'order',
    ]);

    const res = await Noco.ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE_USER,
      updateData,
      {
        fk_user_id: userId,
        fk_workspace_id: workspaceId,
      },
    );

    if (o) {
      Object.assign(o, updateData);
      // set cache
      await NocoCache.set(key, o);
    }

    return res;
  }

  static async delete(workspaceId: any, userId: any) {
    await NocoCache.del(
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
    );
    return await Noco.ncMeta.metaDelete(null, null, MetaTable.WORKSPACE_USER, {
      fk_user_id: userId,
      fk_workspace_id: workspaceId,
    });
  }

  static async getByToken(invitationToken: any, userId: string) {
    const workspaceUser = await Noco.ncMeta.metaGet2(
      null,
      null,
      MetaTable.WORKSPACE_USER,
      {
        invite_token: invitationToken,
        fk_user_id: userId,
      },
    );
    return new WorkspaceUser(workspaceUser);
  }
}
