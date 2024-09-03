import { ProjectRoles } from 'nocodb-sdk';
import type { BaseType } from 'nocodb-sdk';
import type User from '~/models/User';
import type { NcContext } from '~/interface/config';
import Base from '~/models/Base';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp } from '~/utils/modelUtils';
import { NcError } from '~/helpers/catchError';

export default class BaseUser {
  fk_workspace_id?: string;
  base_id: string;
  fk_user_id: string;
  roles?: string;
  invited_by?: string;

  constructor(data: BaseUser) {
    Object.assign(this, data);
  }

  protected static castType(baseUser: BaseUser): BaseUser {
    return baseUser && new BaseUser(baseUser);
  }

  public static async bulkInsert(
    context: NcContext,
    baseUsers: Partial<BaseUser>[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = baseUsers.map((baseUser) =>
      extractProps(baseUser, ['fk_user_id', 'base_id', 'roles', 'invited_by']),
    );

    if (!insertObj.length) {
      return;
    }

    const bulkData = await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    const uniqueFks: string[] = [
      ...new Set(bulkData.map((d) => d.base_id)),
    ] as string[];

    for (const fk of uniqueFks) {
      await NocoCache.deepDel(
        `${CacheScope.BASE_USER}:${fk}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const d of bulkData) {
      await NocoCache.set(
        `${CacheScope.BASE_USER}:${d.base_id}:${d.fk_user_id}`,
        d,
      );

      await NocoCache.appendToList(
        CacheScope.BASE_USER,
        [d.base_id],
        `${CacheScope.BASE_USER}:${d.base_id}:${d.fk_user_id}`,
      );
    }
  }

  public static async insert(
    context: NcContext,
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(baseUser, [
      'fk_user_id',
      'base_id',
      'roles',
      'invited_by',
    ]);

    const { base_id, fk_user_id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    const res = await this.get(context, base_id, fk_user_id, ncMeta);

    await NocoCache.appendToList(
      CacheScope.BASE_USER,
      [base_id],
      `${CacheScope.BASE_USER}:${base_id}:${fk_user_id}`,
    );

    return res;
  }

  // public static async update(id, user: Partial<BaseUser>, ncMeta = Noco.ncMeta) {
  //   // return await ncMeta.metaUpdate(context.workspace_id, context.base_id, insertObj);
  // }
  static async get(
    context: NcContext,
    baseId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let baseUser =
      baseId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.BASE_USER}:${baseId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseUser || !baseUser.roles) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          `${MetaTable.USERS}.invite_token`,
          `${MetaTable.USERS}.roles as main_roles`,
          `${MetaTable.USERS}.created_at as created_at`,
          `${MetaTable.PROJECT_USERS}.base_id`,
          `${MetaTable.PROJECT_USERS}.roles as roles`,
        );

      queryBuilder.leftJoin(MetaTable.PROJECT_USERS, function () {
        this.on(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.PROJECT_USERS}.base_id`,
          '=',
          ncMeta.knex.raw('?', [baseId]),
        );
      });

      queryBuilder.where(`${MetaTable.USERS}.id`, userId);

      baseUser = await queryBuilder.first();

      if (baseUser) {
        await NocoCache.set(
          `${CacheScope.BASE_USER}:${baseId}:${userId}`,
          baseUser,
        );
      }
    }
    return this.castType(baseUser);
  }

  public static async getUsersList(
    context: NcContext,
    {
      base_id,
      mode = 'full',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      include_ws_deleted = true,
    }: {
      base_id: string;
      mode?: 'full' | 'viewer';
      include_ws_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<(Partial<User> & BaseUser)[]> {
    const cachedList = await NocoCache.getList(CacheScope.BASE_USER, [base_id]);
    let { list: baseUsers } = cachedList;
    const { isNoneList } = cachedList;

    const fullVersionCols = ['invite_token'];

    if (!isNoneList && !baseUsers.length) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          `${MetaTable.USERS}.invite_token`,
          `${MetaTable.USERS}.roles as main_roles`,
          `${MetaTable.USERS}.created_at as created_at`,
          `${MetaTable.PROJECT_USERS}.base_id`,
          `${MetaTable.PROJECT_USERS}.roles as roles`,
        );

      queryBuilder.leftJoin(MetaTable.PROJECT_USERS, function () {
        this.on(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.PROJECT_USERS}.base_id`,
          '=',
          ncMeta.knex.raw('?', [base_id]),
        );
      });

      baseUsers = await queryBuilder;

      baseUsers = baseUsers.map((baseUser) => {
        baseUser.base_id = base_id;
        return this.castType(baseUser);
      });

      await NocoCache.setList(CacheScope.BASE_USER, [base_id], baseUsers, [
        'base_id',
        'id',
      ]);
    }

    if (mode === 'full') {
      return baseUsers;
    }

    // remove full version props if viewer
    for (const user of baseUsers) {
      for (const prop of fullVersionCols) {
        delete user[prop];
      }
    }

    return baseUsers;
  }

  public static async getUsersCount(
    context: NcContext,
    {
      base_id,
      query,
    }: {
      base_id: string;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const queryBuilder = ncMeta.knex(MetaTable.USERS);

    if (query) {
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    queryBuilder.leftJoin(MetaTable.PROJECT_USERS, function () {
      this.on(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        '=',
        `${MetaTable.USERS}.id`,
      ).andOn(
        `${MetaTable.PROJECT_USERS}.base_id`,
        '=',
        ncMeta.knex.raw('?', [base_id]),
      );
    });

    return (await queryBuilder.count('id', { as: 'count' }).first()).count;
  }

  static async updateRoles(
    context: NcContext,
    baseId,
    userId,
    roles: string,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      {
        roles,
      },
      {
        fk_user_id: userId,
        base_id: baseId,
      },
    );

    await NocoCache.update(`${CacheScope.BASE_USER}:${baseId}:${userId}`, {
      roles,
    });

    return res;
  }

  static async update(
    context: NcContext,
    baseId,
    userId,
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(baseUser, ['starred', 'hidden', 'order']);

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      updateObj,
      {
        fk_user_id: userId,
        base_id: baseId,
      },
    );

    await NocoCache.update(
      `${CacheScope.BASE_USER}:${baseId}:${userId}`,
      updateObj,
    );

    return await this.get(context, baseId, userId, ncMeta);
  }

  static async delete(
    context: NcContext,
    baseId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // delete meta
    const response = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      {
        fk_user_id: userId,
        base_id: baseId,
      },
    );

    // delete list cache to refresh list
    await NocoCache.deepDel(
      `${CacheScope.BASE_USER}:${baseId}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return response;
  }

  static async getProjectsIdList(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseUser[]> {
    if (!userId) NcError.badRequest('User Id is required');

    return await ncMeta.knex(MetaTable.PROJECT_USERS).where({
      fk_user_id: userId,
    });
  }

  static async getProjectsList(
    userId: string,
    params: any,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseType[]> {
    // TODO implement CacheScope.USER_BASE
    const qb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.id`)
      .select(`${MetaTable.PROJECT}.title`)
      .select(`${MetaTable.PROJECT}.prefix`)
      .select(`${MetaTable.PROJECT}.status`)
      .select(`${MetaTable.PROJECT}.description`)
      .select(`${MetaTable.PROJECT}.meta`)
      .select(`${MetaTable.PROJECT}.color`)
      .select(`${MetaTable.PROJECT}.is_meta`)
      .select(`${MetaTable.PROJECT}.created_at`)
      .select(`${MetaTable.PROJECT}.updated_at`)
      .select(`${MetaTable.PROJECT_USERS}.starred`)
      .select(`${MetaTable.PROJECT_USERS}.roles as project_role`)
      .select(`${MetaTable.PROJECT_USERS}.updated_at as last_accessed`)
      .leftJoin(MetaTable.PROJECT_USERS, function () {
        this.on(
          `${MetaTable.PROJECT_USERS}.base_id`,
          `${MetaTable.PROJECT}.id`,
        );
        this.andOn(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          ncMeta.knex.raw('?', [userId]),
        );
      })
      .where(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        ncMeta.knex.raw('?', [userId]),
      )
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      })
      .where(function () {
        this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhereNot(
          `${MetaTable.PROJECT_USERS}.roles`,
          ProjectRoles.NO_ACCESS,
        );
      });

    // filter starred bases
    if (params.starred) {
      qb.where(`${MetaTable.PROJECT_USERS}.starred`, true);
    }

    // filter shared with me bases
    if (params.shared) {
      qb.where(function () {
        // include bases belongs project_user in which user is not owner
        this.where(function () {
          this.where(`${MetaTable.PROJECT_USERS}.fk_user_id`, userId)
            .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.OWNER)
            .whereNotNull(`${MetaTable.PROJECT_USERS}.roles`);
        });
      });
    }

    // order based on recently accessed
    if (params.recent) {
      qb.orderBy(`${MetaTable.PROJECT_USERS}.updated_at`, 'desc');
    }

    qb.whereNot(`${MetaTable.PROJECT}.deleted`, true);

    const baseList = await qb;

    if (baseList && baseList?.length) {
      const promises = [];

      const castedProjectList = baseList
        .filter((p) => !params?.type || p.type === params.type)
        .sort(
          (a, b) =>
            (a.order != null ? a.order : Infinity) -
            (b.order != null ? b.order : Infinity),
        )
        .map((p) => {
          const base = Base.castType(p);
          base.meta = parseMetaProp(base);
          promises.push(base.getSources(false, ncMeta));
          return base;
        });

      await Promise.all(promises);

      return castedProjectList;
    } else {
      return [];
    }
  }

  static async updateOrInsert(
    context: NcContext,
    baseId,
    userId,
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const existingProjectUser = await this.get(context, baseId, userId, ncMeta);

    if (existingProjectUser) {
      return await this.update(context, baseId, userId, baseUser, ncMeta);
    } else {
      return await this.insert(context, {
        base_id: baseId,
        fk_user_id: userId,
        invited_by: baseUser.invited_by,
      });
    }
  }
}
