import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
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
import { cleanCommandPaletteCacheForUser } from '~/helpers/commandPaletteHelpers';
import { MCPToken } from '~/models/index';

const logger = new Logger('BaseUser');

export default class BaseUser {
  fk_workspace_id?: string;
  base_id: string;
  fk_user_id: string;
  roles?: string;
  invited_by?: string;
  starred?: boolean;
  order?: number;
  hidden?: boolean;

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
        context,
        `${CacheScope.BASE_USER}:${fk}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const d of bulkData) {
      await NocoCache.set(
        context,
        `${CacheScope.BASE_USER}:${d.base_id}:${d.fk_user_id}`,
        d,
      );

      await NocoCache.appendToList(
        context,
        CacheScope.BASE_USER,
        [d.base_id],
        `${CacheScope.BASE_USER}:${d.base_id}:${d.fk_user_id}`,
      );

      cleanCommandPaletteCacheForUser(d.fk_user_id).catch(() => {
        logger.error('Error cleaning command palette cache');
      });
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
      'starred',
      'order',
      'hidden',
    ]);

    const { base_id, fk_user_id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    // delete list to fetch updated list next time
    await NocoCache.deepDel(
      context,
      `${CacheScope.BASE_USER}:${base_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    cleanCommandPaletteCacheForUser(fk_user_id).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return this.get(context, base_id, fk_user_id, ncMeta).then(
      async (baseUser) => {
        await NocoCache.appendToList(
          context,
          CacheScope.BASE_USER,
          [base_id],
          `${CacheScope.BASE_USER}:${base_id}:${fk_user_id}`,
        );
        return baseUser;
      },
    );
  }

  // public static async update(id, user: Partial<BaseUser>, ncMeta = Noco.ncMeta) {
  //   // return await ncMeta.metaUpdate(context.workspace_id, context.base_id, insertObj);
  // }
  static async get(
    context: NcContext,
    baseId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseUser & { is_mapped?: boolean; deleted?: boolean }> {
    let baseUser =
      baseId &&
      userId &&
      (await NocoCache.get(
        context,
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
          `${MetaTable.USERS}.meta`,
          `${MetaTable.PROJECT_USERS}.base_id`,
          `${MetaTable.PROJECT_USERS}.roles as roles`,
          `${MetaTable.WORKSPACE_USER}.roles as workspace_roles`,
        );

      if (context.workspace_id) {
        queryBuilder.innerJoin(MetaTable.WORKSPACE_USER, function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            '=',
            ncMeta.knex.raw('?', [context.workspace_id]),
          );
        });
      }

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
        baseUser.meta = parseMetaProp(baseUser);

        await NocoCache.set(
          context,
          `${CacheScope.BASE_USER}:${baseId}:${userId}`,
          baseUser,
        );
      }
    }

    // decide if user is mapped to base by checking if base_id is present
    // base_id will be null if base_user entry is not present
    if (baseUser) {
      baseUser.is_mapped = !!baseUser.base_id;
    }

    return this.castType(baseUser);
  }

  public static async getUsersList(
    context: NcContext,
    {
      base_id,
      mode = 'full',
      strict_in_record = false,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      include_ws_deleted = true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      include_internal_user = false,
      user_ids,
    }: {
      base_id: string;
      mode?: 'full' | 'viewer';
      strict_in_record?: boolean;
      include_ws_deleted?: boolean;
      include_internal_user?: boolean;
      user_ids?: string[];
      include_team_users?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<(Partial<User> & BaseUser & { deleted?: boolean })[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.BASE_USER, [
      base_id,
    ]);
    let { list: baseUsers } = cachedList;
    const { isNoneList } = cachedList;

    const fullVersionCols = ['invite_token'];

    if (strict_in_record || (!isNoneList && !baseUsers.length)) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          `${MetaTable.USERS}.invite_token`,
          `${MetaTable.USERS}.roles as main_roles`,
          `${MetaTable.USERS}.created_at as created_at`,
          `${MetaTable.USERS}.meta`,
          `${MetaTable.PROJECT_USERS}.base_id`,
          `${MetaTable.PROJECT_USERS}.roles as roles`,
          `${MetaTable.WORKSPACE_USER}.roles as workspace_roles`,
        );

      const joinClause = strict_in_record ? 'innerJoin' : 'leftJoin';
      queryBuilder
        .innerJoin(MetaTable.WORKSPACE_USER, function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            '=',
            ncMeta.knex.raw('?', [context.workspace_id]),
          );
        })
        [joinClause](MetaTable.PROJECT_USERS, function () {
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

      // No is_deleted filter here — soft-deleted users are excluded at the
      // workspace level (WorkspaceUser.softDeleteByUser removes memberships).
      // This list intentionally includes them so user fields (created_by,
      // last_modified_by) can still render historical "Anonymous" entries.

      baseUsers = await queryBuilder;

      baseUsers = baseUsers.map((baseUser) => {
        if (baseUser) {
          baseUser.base_id = base_id;
          baseUser.meta = parseMetaProp(baseUser);
        }

        return this.castType(baseUser);
      });

      if (!strict_in_record) {
        await NocoCache.setList(
          context,
          CacheScope.BASE_USER,
          [base_id],
          baseUsers,
          ['base_id', 'id'],
        );
      }
    }

    if (user_ids) {
      baseUsers = baseUsers.filter((u) => user_ids.includes(u.id));
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

    await NocoCache.update(
      context,
      `${CacheScope.BASE_USER}:${baseId}:${userId}`,
      {
        roles,
      },
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
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
      context,
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

    // delete individual cache and remove from parent list
    await NocoCache.deepDel(
      context,
      `${CacheScope.BASE_USER}:${baseId}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    await MCPToken.bulkDelete({ fk_user_id: userId }, ncMeta);
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
    const workspaceId = params.workspaceId;

    // TODO implement CacheScope.USER_BASE
    const qb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .select(`${MetaTable.PROJECT_USERS}.starred`)
      .select(`${MetaTable.PROJECT_USERS}.roles as project_role`)
      .select(`${MetaTable.PROJECT_USERS}.updated_at as last_accessed`);

    // If workspaceId is provided, also select workspace_role for inheritance
    if (workspaceId) {
      qb.select(`${MetaTable.WORKSPACE_USER}.roles as workspace_role`).leftJoin(
        MetaTable.WORKSPACE_USER,
        function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            ncMeta.knex.raw('?', [userId]),
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            ncMeta.knex.raw('?', [workspaceId]),
          );
        },
      );
    }

    qb.leftJoin(MetaTable.PROJECT_USERS, function () {
      this.on(`${MetaTable.PROJECT_USERS}.base_id`, `${MetaTable.PROJECT}.id`);
      this.andOn(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        ncMeta.knex.raw('?', [userId]),
      );
    })
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      })
      .whereNot(`${MetaTable.PROJECT}.deleted`, true);

    if (workspaceId) {
      // Scope to workspace
      qb.where(`${MetaTable.PROJECT}.fk_workspace_id`, workspaceId);

      // Include bases where user has access via:
      // 1. Explicit base role (not NO_ACCESS, not INHERIT)
      // 2. OR base role is null/INHERIT and workspace role grants access
      qb.where(function () {
        this.where(function () {
          // Priority 1: explicit base role that is not NO_ACCESS and not INHERIT
          this.whereNotNull(`${MetaTable.PROJECT_USERS}.roles`)
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.NO_ACCESS,
            )
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.INHERIT,
            )
            .andWhere(`${MetaTable.PROJECT_USERS}.roles`, '!=', 'inherit');
        }).orWhere(function () {
          // Priority 2: no explicit base role (or INHERIT) — fall through to workspace role
          this.where(function () {
            this.whereNull(`${MetaTable.PROJECT_USERS}.roles`)
              .orWhere(
                `${MetaTable.PROJECT_USERS}.roles`,
                '=',
                ProjectRoles.INHERIT,
              )
              .orWhere(`${MetaTable.PROJECT_USERS}.roles`, '=', 'inherit');
          })
            .whereNotNull(`${MetaTable.WORKSPACE_USER}.roles`)
            .andWhere(
              `${MetaTable.WORKSPACE_USER}.roles`,
              '!=',
              WorkspaceUserRoles.NO_ACCESS,
            );
        });
      });
    } else {
      // Legacy behavior: require explicit PROJECT_USERS entry
      qb.where(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        ncMeta.knex.raw('?', [userId]),
      ).where(function () {
        this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhereNot(
          `${MetaTable.PROJECT_USERS}.roles`,
          ProjectRoles.NO_ACCESS,
        );
      });
    }

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
        starred: baseUser.starred,
        order: baseUser.order,
        hidden: baseUser.hidden,
      });
    }
  }
}
