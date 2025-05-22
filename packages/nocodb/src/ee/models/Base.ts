import BaseCE from 'src/models/Base';
import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { BaseType } from 'nocodb-sdk';
import type { DB_TYPES } from '~/utils/globals';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';

import {
  BaseUser,
  CustomUrl,
  DataReflection,
  MCPToken,
  Source,
} from '~/models';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('Base');

export default class Base extends BaseCE {
  public type?: 'database';

  public static castType(base: Base): Base {
    return base && new Base(base);
  }

  static async list(
    workspaceId?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseCE[]> {
    if (!workspaceId) {
      return [];
    }

    const cachedList = await NocoCache.getList(CacheScope.PROJECT, [
      workspaceId,
    ]);
    let { list: baseList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseList.length) {
      baseList = await ncMeta.metaList2(
        RootScopes.BASE,
        RootScopes.BASE,
        MetaTable.PROJECT,
        {
          xcCondition: {
            _and: [
              {
                fk_workspace_id: {
                  eq: workspaceId,
                },
              },
              {
                _or: [
                  {
                    deleted: {
                      eq: false,
                    },
                  },
                  {
                    deleted: {
                      eq: null,
                    },
                  },
                  {
                    is_snapshot: {
                      neq: true,
                    },
                  },
                ],
              },
            ],
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.PROJECT, [workspaceId], baseList);
    }

    return baseList
      .filter(
        (p) => p.deleted === 0 || p.deleted === false || p.deleted === null,
      )
      .sort(
        (a, b) =>
          (a.order != null ? a.order : Infinity) -
          (b.order != null ? b.order : Infinity),
      )
      .map((m) => this.castType(m));
  }

  public static async createProject(
    base: Partial<BaseType> & { fk_workspace_id?: string },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseCE> {
    const insertObj = extractProps(base, [
      'id',
      'title',
      'prefix',
      'description',
      'is_meta',
      'status',
      'type',
      'fk_workspace_id',
      'meta',
      'color',
      'order',
      'is_snapshot',
    ]);

    if (!insertObj.order) {
      // get order value
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.PROJECT, {});
    }

    // stringify meta
    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }
    // set default meta if not present
    else if (!('meta' in insertObj)) {
      insertObj.meta = '{"iconColor":"#36BFFF"}';
    }

    const { id: baseId } = await ncMeta.metaInsert2(
      RootScopes.BASE,
      RootScopes.BASE,
      MetaTable.PROJECT,
      insertObj,
    );

    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: baseId,
    } as NcContext;

    for (const source of base.sources) {
      await Source.createBase(
        context,
        {
          type: source.config?.client as (typeof DB_TYPES)[number],
          ...source,
          baseId,
        },
        ncMeta,
      );
    }

    await DataReflection.grantBase(base.fk_workspace_id, base.id, ncMeta);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await NocoCache.del(CacheScope.INSTANCE_META);
    return this.getWithInfo(context, baseId, true, ncMeta).then(
      async (base) => {
        await NocoCache.appendToList(
          CacheScope.PROJECT,
          [base.fk_workspace_id],
          `${CacheScope.PROJECT}:${baseId}`,
        );
        return base;
      },
    );
  }

  // @ts-ignore
  static async update(
    context: NcContext,
    baseId: string,
    base: Partial<Base> & { fk_workspace_id?: string },
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const updateObj = extractProps(base, [
      'title',
      'prefix',
      'status',
      'description',
      'meta',
      'color',
      'deleted',
      'order',
      'sources',
      'uuid',
      'password',
      'roles',
      'fk_workspace_id',
      'is_snapshot',
      'fk_custom_url_id',
    ]);

    // stringify meta
    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // get existing cache
    const key = `${CacheScope.PROJECT}:${baseId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      // new uuid is generated
      if (o.uuid && updateObj.uuid && o.uuid !== updateObj.uuid) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.uuid}`);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${updateObj.uuid}`,
          baseId,
        );
      }
      // disable shared base
      if (o.uuid && updateObj.uuid === null) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.uuid}`);
      }
      if (o.title && updateObj.title && o.title !== updateObj.title) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.title}`);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${updateObj.title}`,
          baseId,
        );
      }
      o = { ...o, ...updateObj };

      await NocoCache.del(CacheScope.INSTANCE_META);

      // set cache
      await NocoCache.set(key, o);
    }

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // set meta
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      updateObj,
      baseId,
    );
  }

  static async getWithInfo(
    context: NcContext,
    baseId: string,
    includeConfig = true,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseCE> {
    let base: Base = await super.getWithInfo(
      context,
      baseId,
      includeConfig,
      ncMeta,
    );

    if (base) {
      base = this.castType(base);
    }

    return base as BaseCE;
  }

  static async delete(
    context: NcContext,
    baseId,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      baseId,
    );

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    const users = await BaseUser.getUsersList(
      context,
      {
        base_id: baseId,
        include_ws_deleted: true,
      },
      ncMeta,
    );

    for (const user of users) {
      await BaseUser.delete(context, baseId, user.id, ncMeta);
    }

    // remove left over users (used for workspace template)
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      {
        base_id: baseId,
      },
    );

    const sources = await Source.list(
      context,
      { baseId, includeDeleted: true },
      ncMeta,
    );
    for (const source of sources) {
      await source.delete(context, ncMeta, { force: true });
    }

    await DataReflection.revokeBase(base.fk_workspace_id, base.id, ncMeta);

    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      baseId,
    );

    if (base) {
      // delete <scope>:<uuid>
      // delete <scope>:<title>
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del([
        `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
        `${CacheScope.PROJECT_ALIAS}:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
        `${CacheScope.BASE_TO_WORKSPACE}:${baseId}`,
      ]);
    }

    await NocoCache.deepDel(
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del(`${CacheScope.BASE_TO_WORKSPACE}:${baseId}`);

    await ncMeta.metaDelete(RootScopes.ROOT, RootScopes.ROOT, MetaTable.AUDIT, {
      base_id: baseId,
    });

    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return res;
  }

  // @ts-ignore
  static async softDelete(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base = await this.get(context, baseId, ncMeta);

    // skip if missing (already soft deleted)
    if (!base) {
      return;
    }

    await this.clearConnectionPool(context, baseId, ncMeta);

    if (base) {
      // delete <scope>:<id>
      // delete <scope>:<title>
      // delete <scope>:<uuid>
      // delete <scope>:ref:<titleOfId>
      await NocoCache.del([
        `${CacheScope.PROJECT_ALIAS}:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
        `${CacheScope.BASE_TO_WORKSPACE}:${baseId}`,
      ]);
    }

    await NocoCache.del(CacheScope.INSTANCE_META);

    // remove item in cache list
    await NocoCache.deepDel(
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    await DataReflection.revokeBase(base.fk_workspace_id, base.id, ncMeta);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await MCPToken.bulkDelete({ base_id: baseId }, ncMeta);

    // set meta
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      { deleted: true },
      baseId,
    );
  }

  static async clearConnectionPool(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.get(context, baseId, ncMeta);
    if (base) {
      const sources = await base.getSources(false, ncMeta);
      for (const source of sources) {
        // clear connection pool for this instance
        await NcConnectionMgrv2.deleteAwait(source);
        // remove sql executor binding & clear connection pool for other instances
        await Source.update(
          context,
          source.id,
          {
            fk_sql_executor_id: null,
          },
          ncMeta,
        );
      }
    }
  }

  // EXTRA METHODS

  static listByWorkspaceAndUser? = async (
    fk_workspace_id: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) => {
    // Todo: caching , pagination, query optimisation

    const baseListQb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .select(`${MetaTable.WORKSPACE_USER}.roles as workspace_role`)
      .select(`${MetaTable.PROJECT_USERS}.starred`)
      .select(`${MetaTable.PROJECT_USERS}.roles as project_role`)
      .select(`${MetaTable.PROJECT_USERS}.updated_at as last_accessed`)
      .leftJoin(MetaTable.WORKSPACE_USER, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          `${MetaTable.PROJECT}.fk_workspace_id`,
        );
        this.andOn(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          ncMeta.knex.raw('?', [userId]),
        );
      })
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
      .where(`${MetaTable.PROJECT}.fk_workspace_id`, fk_workspace_id)
      .whereNot(`${MetaTable.PROJECT}.deleted`, true)
      .whereNot(`${MetaTable.PROJECT}.is_snapshot`, true)
      .whereNotNull(`${MetaTable.WORKSPACE_USER}.roles`)
      .andWhere(function () {
        this.where(function () {
          this.where(
            `${MetaTable.WORKSPACE_USER}.roles`,
            '!=',
            WorkspaceUserRoles.NO_ACCESS,
          ).andWhere(function () {
            this.andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.NO_ACCESS,
            ).orWhereNull(`${MetaTable.PROJECT_USERS}.roles`);
          });
        }).orWhere(function () {
          this.where(
            `${MetaTable.WORKSPACE_USER}.roles`,
            '=',
            WorkspaceUserRoles.NO_ACCESS,
          )
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.NO_ACCESS,
            )
            .whereNotNull(`${MetaTable.PROJECT_USERS}.roles`);
        });
      });

    const bases = await baseListQb;

    if (bases && bases?.length) {
      const promises = [];

      const castedProjectList = bases
        .sort(
          (a, b) =>
            (a.order != null ? a.order : Infinity) -
            (b.order != null ? b.order : Infinity),
        )
        .map((p) => {
          const base = this.castType(p);
          base.meta = parseMetaProp(base);
          promises.push(base.getSources(false, ncMeta));
          return base;
        });

      await Promise.all(promises);

      return castedProjectList;
    } else {
      return [];
    }
  };

  static async listByWorkspace(
    fk_workspace_id: string,
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    const baseListQb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .where(`${MetaTable.PROJECT}.fk_workspace_id`, fk_workspace_id)
      .whereNot(`${MetaTable.PROJECT}.is_snapshot`, true);

    if (!includeDeleted) {
      baseListQb.where(`${MetaTable.PROJECT}.deleted`, false);
    }

    const bases = await baseListQb;

    if (bases && bases?.length) {
      const promises = [];

      const castedProjectList = bases
        .sort(
          (a, b) =>
            (a.order != null ? a.order : Infinity) -
            (b.order != null ? b.order : Infinity),
        )
        .map((p) => {
          const base = this.castType(p);
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

  static async countByWorkspace(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const count = await ncMeta.metaCount(
      RootScopes.BASE,
      RootScopes.BASE,
      MetaTable.PROJECT,
      {
        condition: {
          fk_workspace_id,
          deleted: false,
        },
        xcCondition: {
          _and: [
            {
              is_snapshot: {
                neq: true,
              },
            },
          ],
        },
      },
    );

    return count;
  }
}
