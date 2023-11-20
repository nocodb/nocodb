import { ProjectRoles } from 'nocodb-sdk';
import type { BaseType } from 'nocodb-sdk';
import User from '~/models/User';
import Base from '~/models/Base';
import {
  // CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp } from '~/utils/modelUtils';

export default class BaseUser {
  base_id: string;
  fk_user_id: string;
  roles?: string;

  constructor(data: BaseUser) {
    Object.assign(this, data);
  }

  protected static castType(baseUser: BaseUser): BaseUser {
    return baseUser && new BaseUser(baseUser);
  }

  public static async insert(
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(baseUser, [
      'fk_user_id',
      'base_id',
      'roles',
    ]);

    const { base_id, fk_user_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    // reset all user bases cache
    await NocoCache.delAll(CacheScope.USER_PROJECT, `${baseUser.fk_user_id}:*`);

    return this.get(base_id, fk_user_id, ncMeta);
  }

  // public static async update(id, user: Partial<BaseUser>, ncMeta = Noco.ncMeta) {
  //   // return await ncMeta.metaUpdate(null, null, MetaTable.USERS, id, insertObj);
  // }
  static async get(baseId: string, userId: string, ncMeta = Noco.ncMeta) {
    let baseUser =
      baseId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_USER}:${baseId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseUser) {
      baseUser = await ncMeta.metaGet2(null, null, MetaTable.PROJECT_USERS, {
        fk_user_id: userId,
        base_id: baseId,
      });
      await NocoCache.set(
        `${CacheScope.PROJECT_USER}:${baseId}:${userId}`,
        baseUser,
      );
    }
    return this.castType(baseUser);
  }

  public static async getUsersList(
    {
      base_id,
      limit = 25,
      offset = 0,
      query,
    }: {
      base_id: string;
      limit: number;
      offset: number;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<(Partial<User> & BaseUser)[]> {
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.created_at as created_at`,
        `${MetaTable.PROJECT_USERS}.base_id`,
        `${MetaTable.PROJECT_USERS}.roles as roles`,
      )
      .offset(offset)
      .limit(limit);

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

    const baseUsers = await queryBuilder;

    return baseUsers;
  }

  public static async getUsersCount(
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
    baseId,
    userId,
    roles: string,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.PROJECT_USER}:${baseId}:${userId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.roles = roles;
      // set cache
      await NocoCache.set(key, o);
    }
    // update user cache
    const user = await User.get(userId);
    if (user) {
      const email = user.email;
      for (const key of [`${CacheScope.USER}:${email}___${baseId}`]) {
        const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
        if (o) {
          o.roles = roles;
          // set cache
          await NocoCache.set(key, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT_USERS,
      {
        roles,
      },
      {
        fk_user_id: userId,
        base_id: baseId,
      },
    );
  }

  static async update(
    baseId,
    userId,
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(baseUser, ['starred', 'hidden', 'order']);

    // get existing cache
    const key = `${CacheScope.PROJECT_USER}:${baseId}:${userId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      Object.assign(o, updateObj);
      // set cache
      await NocoCache.set(key, o);
    }
    // update user cache
    const user = await User.get(userId);
    if (user) {
      const email = user.email;
      for (const key of [
        `${CacheScope.USER}:${email}`,
        `${CacheScope.USER}:${email}___${baseId}`,
      ]) {
        const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
        if (o) {
          Object.assign(o, updateObj);
          // set cache
          await NocoCache.set(key, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT_USERS,
      updateObj,
      {
        fk_user_id: userId,
        base_id: baseId,
      },
    );
  }

  static async delete(baseId: string, userId: string, ncMeta = Noco.ncMeta) {
    const { email } = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
      id: userId,
    });
    if (email) {
      await NocoCache.delAll(CacheScope.USER, `${email}*`);
    }

    // remove base from user base list cache
    const cachedList = await NocoCache.getList(CacheScope.USER_PROJECT, [
      userId,
    ]);
    let { list: cachedProjectList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && cachedProjectList?.length) {
      cachedProjectList = cachedProjectList.filter((p) => p.id !== baseId);
      // delete the whole list first so that the old one won't be included
      await NocoCache.del(`${CacheScope.USER_PROJECT}:${userId}:list`);
      if (cachedProjectList.length > 0) {
        // set the updated list (i.e. excluding the to-be-deleted base id)
        await NocoCache.setList(
          CacheScope.USER_PROJECT,
          [userId],
          cachedProjectList,
        );
      }
    }

    await NocoCache.del(`${CacheScope.PROJECT_USER}:${baseId}:${userId}`);
    return await ncMeta.metaDelete(null, null, MetaTable.PROJECT_USERS, {
      fk_user_id: userId,
      base_id: baseId,
    });
  }

  static async getProjectsIdList(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseUser[]> {
    return await ncMeta.metaList2(null, null, MetaTable.PROJECT_USERS, {
      condition: { fk_user_id: userId },
    });
  }

  static async getProjectsList(
    userId: string,
    params: any,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseType[]> {
    // let baseList: BaseType[];

    // todo: pagination
    // todo: caching based on filter type
    //   = await NocoCache.getList(CacheScope.USER_PROJECT, [
    //   userId,
    // ]);

    // if (baseList.length) {
    //   return baseList;
    // }

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
    if (baseList?.length) {
      // parse meta
      for (const base of baseList) {
        base.meta = parseMetaProp(base);
      }

      await NocoCache.setList(CacheScope.USER_PROJECT, [userId], baseList);
    }

    const castedProjectList = baseList
      .filter((p) => !params?.type || p.type === params.type)
      .map((m) => Base.castType(m));

    await Promise.all(castedProjectList.map((base) => base.getBases(ncMeta)));

    return castedProjectList;
  }

  static async updateOrInsert(
    baseId,
    userId,
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const existingProjectUser = await this.get(baseId, userId, ncMeta);

    if (existingProjectUser) {
      return await this.update(baseId, userId, baseUser, ncMeta);
    } else {
      return await this.insert({ base_id: baseId, fk_user_id: userId });
    }
  }
}
