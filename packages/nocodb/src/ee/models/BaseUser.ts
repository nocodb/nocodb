import { ProjectRoles } from 'nocodb-sdk';
import { BaseUser as BaseUserCE } from 'src/models';
import type { BaseType } from 'nocodb-sdk';
import { CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp } from '~/utils/modelUtils';

export default class BaseUser extends BaseUserCE {
  protected static castType(baseUser: BaseUser): BaseUser {
    return baseUser && new BaseUser(baseUser);
  }

  public static async getUsersList(
    {
      base_id,
      workspace_id,
      limit = 25,
      offset = 0,
      query,
    }: {
      base_id: string;
      workspace_id?: string;
      limit: number;
      offset: number;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
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
        `${MetaTable.WORKSPACE_USER}.roles as workspace_roles`,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id as workspace_id`,
      )
      .offset(offset)
      .limit(limit);

    if (query) {
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    if (workspace_id) {
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
    } else {
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
    }

    const baseUsers = await queryBuilder;

    return baseUsers.map((baseUser) => {
      return this.castType(baseUser);
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
      .select(`${MetaTable.PROJECT}.type`)
      .select(`${MetaTable.PROJECT}.created_at`)
      .select(`${MetaTable.PROJECT}.updated_at`)
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

      await NocoCache.setList(CacheScope.USER_PROJECT, [userId], baseList);
    }

    return baseList.filter((p) => !params?.type || p.type === params.type);
  }
}
