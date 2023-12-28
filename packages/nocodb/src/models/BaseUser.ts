import { ProjectRoles } from 'nocodb-sdk';
import type { BaseType } from 'nocodb-sdk';
import type User from '~/models/User';
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

    const res = await this.get(base_id, fk_user_id, ncMeta);

    await NocoCache.appendToList(
      CacheScope.BASE_USER,
      [base_id],
      `${CacheScope.BASE_USER}:${base_id}:${fk_user_id}`,
    );

    return res;
  }

  // public static async update(id, user: Partial<BaseUser>, ncMeta = Noco.ncMeta) {
  //   // return await ncMeta.metaUpdate(null, null, MetaTable.USERS, id, insertObj);
  // }
  static async get(baseId: string, userId: string, ncMeta = Noco.ncMeta) {
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
    if (!isNoneList && !baseUsers.length) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          ...(mode === 'full'
            ? [
                `${MetaTable.USERS}.invite_token`,
                `${MetaTable.USERS}.roles as main_roles`,
                `${MetaTable.USERS}.created_at as created_at`,
                `${MetaTable.PROJECT_USERS}.base_id`,
                `${MetaTable.PROJECT_USERS}.roles as roles`,
              ]
            : []),
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
    const key = `${CacheScope.BASE_USER}:${baseId}:${userId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.roles = roles;
      // set cache
      await NocoCache.set(key, o);
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

    const key = `${CacheScope.BASE_USER}:${baseId}:${userId}`;

    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.PROJECT_USERS, updateObj, {
      fk_user_id: userId,
      base_id: baseId,
    });

    // delete cache
    await NocoCache.del(key);

    // cache and return
    return await this.get(baseId, userId, ncMeta);
  }

  static async delete(baseId: string, userId: string, ncMeta = Noco.ncMeta) {
    // delete meta
    const response = await ncMeta.metaDelete(
      null,
      null,
      MetaTable.PROJECT_USERS,
      {
        fk_user_id: userId,
        base_id: baseId,
      },
    );

    // delete list cache to refresh list
    await NocoCache.del(`${CacheScope.BASE_USER}:${baseId}:${userId}`);
    await NocoCache.del(`${CacheScope.BASE_USER}:${baseId}:list`);

    return response;
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
    if (baseList?.length) {
      // parse meta
      for (const base of baseList) {
        base.meta = parseMetaProp(base);
      }
    }

    const castedProjectList = baseList
      .filter((p) => !params?.type || p.type === params.type)
      .map((m) => Base.castType(m));

    await Promise.all(castedProjectList.map((base) => base.getSources(ncMeta)));

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
