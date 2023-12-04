import { ProjectRoles } from 'nocodb-sdk';
import { User } from 'src/models';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Base from '~/models/Base';

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
    baseUser: Partial<WorkspaceUser & { created_at?: any; updated_at?: any }>,
    ncMeta = Noco.ncMeta,
  ) {
    const order = await ncMeta.metaGetNextOrder(MetaTable.WORKSPACE_USER, {
      fk_user_id: baseUser.fk_user_id,
    });
    const { fk_workspace_id, fk_user_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.WORKSPACE_USER,
      {
        fk_user_id: baseUser.fk_user_id,
        fk_workspace_id: baseUser.fk_workspace_id,
        roles: baseUser.roles,
        created_at: baseUser.created_at,
        updated_at: baseUser.updated_at,
        order: baseUser.order ?? order,
      },
      true,
    );

    await NocoCache.del(
      `${CacheScope.WORKSPACE}:${baseUser.fk_workspace_id}:userCount`,
    );

    // clear base user list caches
    const bases = await Base.listByWorkspace(baseUser.fk_workspace_id, ncMeta);
    for (const base of bases) {
      await NocoCache.del(`${CacheScope.BASE_USER}:${base.id}:list`);
    }

    const res = await this.get(fk_workspace_id, fk_user_id, ncMeta);

    // add to workspace user list cache
    await NocoCache.appendToList(
      CacheScope.WORKSPACE_USER,
      [fk_workspace_id],
      `${CacheScope.WORKSPACE_USER}:${fk_workspace_id}:${fk_user_id}`,
    );

    return res;
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
      if (workspaceUser) {
        const {
          id,
          email,
          display_name,
          roles: main_roles,
        } = await User.get(userId, ncMeta);

        workspaceUser = {
          ...workspaceUser,
          id,
          email,
          display_name,
          main_roles,
        };

        await NocoCache.set(
          `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
          workspaceUser,
        );
      }
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
      )
      .where(`${MetaTable.WORKSPACE}.deleted`, false);

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
              `${MetaTable.PROJECT_USERS}.base_id`,
              '=',
              `${MetaTable.PROJECT}.id`,
            ).andOn(
              `${MetaTable.PROJECT_USERS}.fk_user_id`,
              '=',
              ncMeta.knex.raw('?', [fk_user_id]),
            );
          })
          .where(function () {
            this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhereNot(
              `${MetaTable.PROJECT_USERS}.roles`,
              ProjectRoles.NO_ACCESS,
            );
          }),
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
    const cachedList = await NocoCache.getList(CacheScope.WORKSPACE_USER, [
      fk_workspace_id,
    ]);
    let { list: workspaceUsers } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !workspaceUsers.length) {
      const queryBuilder = ncMeta.knex(MetaTable.USERS).select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
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

      workspaceUsers = await queryBuilder;

      await NocoCache.setList(
        CacheScope.WORKSPACE_USER,
        [fk_workspace_id],
        workspaceUsers,
        ['fk_workspace_id', 'id'],
      );
    }

    return workspaceUsers;
  }

  static async count({ workspaceId }: { workspaceId: any }) {
    const key = `${CacheScope.WORKSPACE}:${workspaceId}:userCount`;
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
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`;

    const updateData = extractProps(_updateData, [
      'roles',
      'deleted',
      'invite_token',
      'invite_accepted',
      'deleted',
      'deleted_at',
      'order',
    ]);

    await Noco.ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE_USER,
      updateData,
      {
        fk_user_id: userId,
        fk_workspace_id: workspaceId,
      },
    );

    // clear existing cache
    await NocoCache.del(key);

    // cache and return
    return this.get(workspaceId, userId, ncMeta);
  }

  static async delete(workspaceId: any, userId: any) {
    const res = await Noco.ncMeta.metaDelete(
      null,
      null,
      MetaTable.WORKSPACE_USER,
      {
        fk_user_id: userId,
        fk_workspace_id: workspaceId,
      },
    );

    // delete cache
    await NocoCache.deepDel(
      CacheScope.WORKSPACE_USER,
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.del(`${CacheScope.WORKSPACE}:${workspaceId}:userCount`);

    return res;
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
