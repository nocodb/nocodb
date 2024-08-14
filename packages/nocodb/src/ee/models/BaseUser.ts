import { ProjectRoles } from 'nocodb-sdk';
import { BaseUser as BaseUserCE } from 'src/models';
import type { BaseType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp } from '~/utils/modelUtils';
import Base from '~/models/Base';
import { extractProps } from '~/helpers/extractProps';
import WorkspaceUser from '~/models/WorkspaceUser';

export default class BaseUser extends BaseUserCE {
  protected static castType(baseUser: BaseUser): BaseUser {
    return baseUser && new BaseUser(baseUser);
  }

  public static async bulkInsert(
    context: NcContext,
    baseUsers: Partial<BaseUser>[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = [];
    for (const baseUser of baseUsers) {
      const tempObj = extractProps(baseUser, [
        'fk_user_id',
        'base_id',
        'roles',
      ]);
      insertObj.push(tempObj);
    }

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
    const base = await Base.get(context, baseUser.base_id, ncMeta);
    const workspace_id = base.fk_workspace_id;

    const wsUser = await WorkspaceUser.get(
      workspace_id,
      baseUser.fk_user_id,
      ncMeta,
    );

    if (!wsUser) {
      throw new Error('User is not part of workspace');
    }

    const insertObj = extractProps(baseUser, [
      'fk_user_id',
      'base_id',
      'roles',
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
      const base = await Base.get(context, baseId, ncMeta);
      const workspace_id = base.fk_workspace_id;
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
          ...(workspace_id
            ? [
                `${MetaTable.WORKSPACE_USER}.roles as workspace_roles`,
                `${MetaTable.WORKSPACE_USER}.fk_workspace_id as workspace_id`,
              ]
            : []),
        );

      queryBuilder
        .innerJoin(MetaTable.WORKSPACE_USER, function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            '=',
            ncMeta.knex.raw('?', [workspace_id]),
          );
        })
        .leftJoin(MetaTable.PROJECT_USERS, function () {
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
      include_ws_deleted = true,
    }: {
      base_id: string;
      mode?: 'full' | 'viewer';
      include_ws_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.BASE_USER, [base_id]);
    let { list: baseUsers } = cachedList;
    const { isNoneList } = cachedList;

    const fullVersionCols = [
      'invite_token',
      'created_at',
      'base_id',
      'workspace_id',
      'deleted',
    ];

    if (!isNoneList && !baseUsers.length) {
      const queryBuilder = ncMeta.knex(MetaTable.USERS).select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,

        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.created_at as created_at`,
        `${MetaTable.PROJECT_USERS}.base_id`,
        `${MetaTable.PROJECT_USERS}.roles as roles`,
        `${MetaTable.WORKSPACE_USER}.roles as workspace_roles`,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id as workspace_id`,
        `${MetaTable.WORKSPACE_USER}.deleted as deleted`,
      );

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
        .leftJoin(MetaTable.PROJECT_USERS, function () {
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

    if (!include_ws_deleted) {
      baseUsers = baseUsers.filter((u) => !u.deleted);
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
      .select(`${MetaTable.PROJECT}.type`)
      .select(`${MetaTable.PROJECT}.created_at`)
      .select(`${MetaTable.PROJECT}.updated_at`)
      .select(`${MetaTable.PROJECT}.fk_workspace_id`)
      // .select(`${MetaTable.WORKSPACE_USER}.roles as workspace_role`)
      // .select(`${MetaTable.WORKSPACE}.title as workspace_title`)
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
      return baseList
        .filter((p) => !params?.type || p.type === params.type)
        .sort(
          (a, b) =>
            (a.order != null ? a.order : Infinity) -
            (b.order != null ? b.order : Infinity),
        )
        .map((p) => {
          p.meta = parseMetaProp(p);
          return Base.castType(p);
        });
    } else {
      return [];
    }
  }
}
