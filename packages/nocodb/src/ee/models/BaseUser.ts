import { ProjectRoles } from 'nocodb-sdk';
import { BaseUser as BaseUserCE } from 'src/models';
import type { BaseType } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp } from '~/utils/modelUtils';
import Base from '~/models/Base';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';

export default class BaseUser extends BaseUserCE {
  fk_workspace_id?: string;

  protected static castType(baseUser: BaseUser): BaseUser {
    return baseUser && new BaseUser(baseUser);
  }

  static async get(baseId: string, userId: string, ncMeta = Noco.ncMeta) {
    let baseUser =
      baseId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.BASE_USER}:${baseId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseUser || !baseUser.roles) {
      const base = await Base.get(baseId, ncMeta);
      const workspace_id = (base as any)?.fk_workspace_id;
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
    {
      base_id,
      mode = 'full',
    }: {
      base_id: string;
      mode?: 'full' | 'viewer';
    },
    ncMeta = Noco.ncMeta,
  ) {
    const workspace_id = await getWorkspaceForBase(base_id);
    const cachedList = await NocoCache.getList(CacheScope.BASE_USER, [base_id]);
    let { list: baseUsers } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseUsers.length) {
      const queryBuilder = ncMeta.knex(MetaTable.USERS).select(
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
    if (baseList?.length) {
      // parse meta
      for (const base of baseList) {
        base.meta = parseMetaProp(base);
      }
    }

    return baseList.filter((p) => !params?.type || p.type === params.type);
  }
}
