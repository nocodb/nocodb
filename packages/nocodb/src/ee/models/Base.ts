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
  PrincipalType,
  ResourceType,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';

import {
  BaseUser,
  CustomUrl,
  Dashboard,
  DataReflection,
  Extension,
  FileReference,
  MCPToken,
  ModelStat,
  Permission,
  Source,
  Workspace,
} from '~/models';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { NcError } from '~/helpers/catchError';
import { cleanBaseSchemaCacheForBase } from '~/helpers/scriptHelper';

const logger = new Logger('Base');

export default class Base extends BaseCE {
  public type?: 'database';
  public permissions?: Permission[];
  public default_role?: 'no-access';

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

    const cachedList = await NocoCache.getList(
      {
        workspace_id: workspaceId,
        base_id: null,
      },
      CacheScope.PROJECT,
      [workspaceId],
    );
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
                is_snapshot: {
                  neq: true,
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
                ],
              },
            ],
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(
        {
          workspace_id: workspaceId,
          base_id: null,
        },
        CacheScope.PROJECT,
        [workspaceId],
        baseList,
      );
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
      'default_role',
    ]);

    // define base type as database if missing
    if (!insertObj.type) {
      insertObj.type = 'database';
    }

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

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await NocoCache.del('root', CacheScope.INSTANCE_META);
    return this.getWithInfo(context, baseId, true, ncMeta).then(
      async (base) => {
        await NocoCache.appendToList(
          {
            workspace_id: base.fk_workspace_id,
            base_id: null,
          },
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
      'default_role',
    ]);

    // stringify meta
    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // get existing cache
    const key = `${CacheScope.PROJECT}:${baseId}`;
    let o = await NocoCache.get(
      {
        workspace_id: context.workspace_id,
        base_id: null,
      },
      key,
      CacheGetType.TYPE_OBJECT,
    );
    if (o) {
      // update data
      // new uuid is generated
      if (o.uuid && updateObj.uuid && o.uuid !== updateObj.uuid) {
        await NocoCache.del(
          {
            workspace_id: context.workspace_id,
            base_id: null,
          },
          `${CacheScope.PROJECT_ALIAS}:${o.uuid}`,
        );
        await NocoCache.set(
          {
            workspace_id: context.workspace_id,
            base_id: null,
          },
          `${CacheScope.PROJECT_ALIAS}:${updateObj.uuid}`,
          baseId,
        );
      }
      // disable shared base
      if (o.uuid && updateObj.uuid === null) {
        await NocoCache.del(
          {
            workspace_id: context.workspace_id,
            base_id: null,
          },
          `${CacheScope.PROJECT_ALIAS}:${o.uuid}`,
        );
      }
      if (o.title && updateObj.title && o.title !== updateObj.title) {
        await NocoCache.del(
          {
            workspace_id: context.workspace_id,
            base_id: null,
          },
          `${CacheScope.PROJECT_ALIAS}:${o.title}`,
        );
        await NocoCache.set(
          {
            workspace_id: context.workspace_id,
            base_id: null,
          },
          `${CacheScope.PROJECT_ALIAS}:${updateObj.title}`,
          baseId,
        );
      }
      o = { ...o, ...updateObj };

      await NocoCache.del('root', CacheScope.INSTANCE_META);

      // set cache
      await NocoCache.set(
        {
          workspace_id: context.workspace_id,
          base_id: null,
        },
        key,
        o,
      );
    }

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    cleanBaseSchemaCacheForBase(context.base_id).catch(() => {
      logger.error('Failed to clean base schema cache');
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

      base.permissions = await Permission.list(context, base.id, ncMeta);
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

    await Dashboard.deleteByBaseId(context, baseId, ncMeta);

    const sources = await Source.list(
      context,
      { baseId, includeDeleted: true },
      ncMeta,
    );
    for (const source of sources) {
      await source.delete(context, ncMeta, { force: true });
    }

    await DataReflection.revokeBase(context.workspace_id, base.id, ncMeta);

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
      await NocoCache.del(
        {
          workspace_id: context.workspace_id,
          base_id: null,
        },
        [
          `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
          `${CacheScope.PROJECT_ALIAS}:${base.title}`,
          `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
          `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
          `${CacheScope.BASE_TO_WORKSPACE}:${baseId}`,
        ],
      );
    }

    await NocoCache.deepDel(
      {
        workspace_id: context.workspace_id,
        base_id: null,
      },
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del(
      {
        workspace_id: context.workspace_id,
        base_id: null,
      },
      `${CacheScope.BASE_TO_WORKSPACE}:${baseId}`,
    );

    await Noco.ncAudit.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        ...(context.workspace_id
          ? { fk_workspace_id: context.workspace_id }
          : {}),
        base_id: baseId,
      },
    );

    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    cleanBaseSchemaCacheForBase(context.base_id).catch(() => {
      logger.error('Failed to clean base schema cache');
    });

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await FileReference.bulkDelete(context, { base_id: baseId }, ncMeta);

    await Extension.deleteByBaseId(context, baseId, ncMeta);

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
      await NocoCache.del(
        {
          workspace_id: context.workspace_id,
          base_id: null,
        },
        [
          `${CacheScope.PROJECT_ALIAS}:${base.title}`,
          `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
          `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
          `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
          `${CacheScope.BASE_TO_WORKSPACE}:${baseId}`,
        ],
      );
    }

    await NocoCache.del('root', CacheScope.INSTANCE_META);

    // remove item in cache list
    await NocoCache.deepDel(
      {
        workspace_id: context.workspace_id,
        base_id: null,
      },
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    await FileReference.bulkDelete(context, { base_id: baseId }, ncMeta);

    await DataReflection.revokeBase(context.workspace_id, base.id, ncMeta);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    cleanBaseSchemaCacheForBase(context.base_id).catch(() => {
      logger.error('Failed to clean base schema cache');
    });

    await MCPToken.bulkDelete({ base_id: baseId }, ncMeta);

    await ModelStat.deleteByBaseId(context, baseId, ncMeta);

    // clear workspace stats cache to recalculate on next access
    await Workspace.clearWorkspaceStatsCache(base.fk_workspace_id);

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

  /**
   * Returns priority level for a base row based on available roles
   * Higher number = higher priority
   * 4: base_role (project_role)
   * 3: team_base_role
   * 2: workspace_role
   * 1: team_workspace_role
   * 0: no access
   */
  private static getPriorityLevel(base: any): number {
    // Priority 4: base_role exists and not NO_ACCESS
    if (base.project_role && base.project_role !== 'NO_ACCESS') {
      return 4;
    }

    // Priority 3: team_base_role exists and not NO_ACCESS
    if (base.team_base_role && base.team_base_role !== 'NO_ACCESS') {
      return 3;
    }

    // Priority 2: workspace_role exists and not NO_ACCESS
    if (base.workspace_role && base.workspace_role !== 'NO_ACCESS') {
      return 2;
    }

    // Priority 1: team_workspace_role exists and not NO_ACCESS
    if (base.team_workspace_role && base.team_workspace_role !== 'NO_ACCESS') {
      return 1;
    }

    // Priority 0: no access
    return 0;
  }

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
      .select('base_team_assignment.roles as team_base_role')
      .select('workspace_team_assignment.roles as team_workspace_role')
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
      // Join for team memberships (user -> team)
      .leftJoin(
        `${MetaTable.PRINCIPAL_ASSIGNMENTS} as user_team_assignment`,
        function () {
          this.on(
            'user_team_assignment.principal_ref_id',
            ncMeta.knex.raw('?', [userId]),
          )
            .andOn(
              'user_team_assignment.principal_type',
              ncMeta.knex.raw('?', [PrincipalType.USER]),
            )
            .andOn(
              'user_team_assignment.resource_type',
              ncMeta.knex.raw('?', [ResourceType.TEAM]),
            )
            .andOn(function () {
              this.on(
                'user_team_assignment.deleted',
                ncMeta.knex.raw('?', [false]),
              ).orOnNull('user_team_assignment.deleted');
            });
        },
      )
      // Join for base-level team assignments (team -> base)
      .leftJoin(
        `${MetaTable.PRINCIPAL_ASSIGNMENTS} as base_team_assignment`,
        function () {
          this.on('base_team_assignment.resource_id', `${MetaTable.PROJECT}.id`)
            .andOn(
              'base_team_assignment.resource_type',
              ncMeta.knex.raw('?', [ResourceType.BASE]),
            )
            .andOn(
              'base_team_assignment.principal_type',
              ncMeta.knex.raw('?', [PrincipalType.TEAM]),
            )
            .andOn(
              'base_team_assignment.principal_ref_id',
              'user_team_assignment.resource_id',
            )
            .andOn(function () {
              this.on(
                'base_team_assignment.deleted',
                ncMeta.knex.raw('?', [false]),
              ).orOnNull('base_team_assignment.deleted');
            });
        },
      )
      // Join for workspace-level team assignments (team -> workspace)
      .leftJoin(
        `${MetaTable.PRINCIPAL_ASSIGNMENTS} as workspace_team_assignment`,
        function () {
          this.on(
            'workspace_team_assignment.resource_id',
            ncMeta.knex.raw('?', [fk_workspace_id]),
          )
            .andOn(
              'workspace_team_assignment.resource_type',
              ncMeta.knex.raw('?', [ResourceType.WORKSPACE]),
            )
            .andOn(
              'workspace_team_assignment.principal_type',
              ncMeta.knex.raw('?', [PrincipalType.TEAM]),
            )
            .andOn(
              'workspace_team_assignment.principal_ref_id',
              'user_team_assignment.resource_id',
            )
            .andOn(function () {
              this.on(
                'workspace_team_assignment.deleted',
                ncMeta.knex.raw('?', [false]),
              ).orOnNull('workspace_team_assignment.deleted');
            });
        },
      )
      .where(`${MetaTable.PROJECT}.fk_workspace_id`, fk_workspace_id)
      .whereNot(`${MetaTable.PROJECT}.deleted`, true)
      .whereNot(`${MetaTable.PROJECT}.is_snapshot`, true)
      .andWhere(function () {
        // Priority order:
        // 1. base_role (direct project user role)
        // 2. team_base_role (base-level team assignment)
        // 3. workspace_role (direct workspace user role)
        // 4. team_workspace_role (workspace-level team assignment)
        this.where(function () {
          // Priority 1: base_role is not null and not no access and not INHERIT
          this.whereNotNull(`${MetaTable.PROJECT_USERS}.roles`)
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.NO_ACCESS,
            )
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              WorkspaceUserRoles.INHERIT,
            )
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.INHERIT,
            )
            .andWhere(`${MetaTable.PROJECT_USERS}.roles`, '!=', 'inherit');
        })
          .orWhere(function () {
            // Priority 2: base_role is null/INHERIT AND team_base_role is not null and not no access
            this.where(function () {
              this.whereNull(`${MetaTable.PROJECT_USERS}.roles`)
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  WorkspaceUserRoles.INHERIT,
                )
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  ProjectRoles.INHERIT,
                )
                .orWhere(`${MetaTable.PROJECT_USERS}.roles`, '=', 'inherit');
            })
              .whereNotNull('base_team_assignment.resource_id')
              .whereNotNull('base_team_assignment.roles')
              .whereRaw('base_team_assignment.roles != ?', [
                ProjectRoles.NO_ACCESS,
              ]);
          })
          .orWhere(function () {
            // Priority 3: base_role is null/INHERIT AND team_base_role is null AND workspace_role is not null and not no access/INHERIT
            this.where(function () {
              this.whereNull(`${MetaTable.PROJECT_USERS}.roles`)
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  WorkspaceUserRoles.INHERIT,
                )
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  ProjectRoles.INHERIT,
                )
                .orWhere(`${MetaTable.PROJECT_USERS}.roles`, '=', 'inherit');
            })
              .whereNull('base_team_assignment.resource_id')
              .whereNotNull(`${MetaTable.WORKSPACE_USER}.roles`)
              .andWhere(
                `${MetaTable.WORKSPACE_USER}.roles`,
                '!=',
                WorkspaceUserRoles.NO_ACCESS,
              )
              .andWhere(
                `${MetaTable.WORKSPACE_USER}.roles`,
                '!=',
                WorkspaceUserRoles.INHERIT,
              );
          })
          .orWhere(function () {
            // Priority 4: base_role is null/INHERIT AND team_base_role is null AND workspace_role is null/INHERIT AND team_workspace_role is not null and not no access
            this.where(function () {
              this.whereNull(`${MetaTable.PROJECT_USERS}.roles`)
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  WorkspaceUserRoles.INHERIT,
                )
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  ProjectRoles.INHERIT,
                )
                .orWhere(`${MetaTable.PROJECT_USERS}.roles`, '=', 'inherit');
            })
              .whereNull('base_team_assignment.resource_id')
              .where(function () {
                this.whereNull(`${MetaTable.WORKSPACE_USER}.roles`)
                  .orWhere(
                    `${MetaTable.WORKSPACE_USER}.roles`,
                    '=',
                    WorkspaceUserRoles.INHERIT,
                  );
              })
              .whereNotNull('workspace_team_assignment.resource_id')
              .whereNotNull('workspace_team_assignment.roles')
              .whereRaw('workspace_team_assignment.roles != ?', [
                WorkspaceUserRoles.NO_ACCESS,
              ]);
          });
      })
      // if private base don't consider workspace role
      .andWhere(function () {
        // Private base logic: only workspace/team workspace assignments need special handling
        this.where(function () {
          // Case 1: base_role exists (direct project user) and not INHERIT - always allowed
          this.whereNotNull(`${MetaTable.PROJECT_USERS}.roles`)
            .andWhere(
              `${MetaTable.PROJECT_USERS}.roles`,
              '!=',
              ProjectRoles.INHERIT,
            )
            .andWhere(`${MetaTable.PROJECT_USERS}.roles`, '!=', 'inherit');
        })
          .orWhere(function () {
            // Case 2: team_base_role exists - always allowed
            this.whereNotNull('base_team_assignment.resource_id');
          })
          .orWhere(function () {
            // Case 3: base_role and team_base_role are null/INHERIT, but workspace_role exists and not INHERIT
            // Need to check if it's not blocked by private base
            this.where(function () {
              this.whereNull(`${MetaTable.PROJECT_USERS}.roles`)
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  WorkspaceUserRoles.INHERIT,
                )
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  ProjectRoles.INHERIT,
                )
                .orWhere(`${MetaTable.PROJECT_USERS}.roles`, '=', 'inherit');
            })
              .whereNull('base_team_assignment.resource_id')
              .whereNotNull(`${MetaTable.WORKSPACE_USER}.roles`)
              .andWhere(
                `${MetaTable.WORKSPACE_USER}.roles`,
                '!=',
                WorkspaceUserRoles.NO_ACCESS,
              )
              .andWhere(
                `${MetaTable.WORKSPACE_USER}.roles`,
                '!=',
                WorkspaceUserRoles.INHERIT,
              )
              .andWhere(function () {
                this.whereNull(`${MetaTable.PROJECT}.default_role`).orWhereNot(
                  `${MetaTable.PROJECT}.default_role`,
                  ProjectRoles.NO_ACCESS,
                );
              });
          })
          .orWhere(function () {
            // Case 4: base_role, team_base_role, workspace_role are null/INHERIT, but team_workspace_role exists
            // Need to check if it's not blocked by private base
            this.where(function () {
              this.whereNull(`${MetaTable.PROJECT_USERS}.roles`)
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  WorkspaceUserRoles.INHERIT,
                )
                .orWhere(
                  `${MetaTable.PROJECT_USERS}.roles`,
                  '=',
                  ProjectRoles.INHERIT,
                )
                .orWhere(`${MetaTable.PROJECT_USERS}.roles`, '=', 'inherit');
            })
              .whereNull('base_team_assignment.resource_id')
              .where(function () {
                this.whereNull(`${MetaTable.WORKSPACE_USER}.roles`)
                  .orWhere(
                    `${MetaTable.WORKSPACE_USER}.roles`,
                    '=',
                    WorkspaceUserRoles.INHERIT,
                  );
              })
              .whereNotNull('workspace_team_assignment.resource_id')
              .whereNotNull('workspace_team_assignment.roles')
              .whereRaw('workspace_team_assignment.roles != ?', [
                WorkspaceUserRoles.NO_ACCESS,
              ])
              .andWhere(function () {
                this.whereNull(`${MetaTable.PROJECT}.default_role`).orWhereNot(
                  `${MetaTable.PROJECT}.default_role`,
                  ProjectRoles.NO_ACCESS,
                );
              });
          });
      });

    const bases = await baseListQb;

    if (bases && bases?.length) {
      // Deduplicate bases: keep the row with highest priority role
      // Priority: base_role > team_base_role > workspace_role > team_workspace_role
      const uniqueBasesMap = new Map();

      for (const base of bases) {
        const baseId = base.id;
        const existing = uniqueBasesMap.get(baseId);

        if (!existing) {
          uniqueBasesMap.set(baseId, base);
        } else {
          // Determine which row has higher priority
          const existingPriority = this.getPriorityLevel(existing);
          const currentPriority = this.getPriorityLevel(base);

          if (currentPriority > existingPriority) {
            uniqueBasesMap.set(baseId, base);
          }
        }
      }

      const uniqueBases = Array.from(uniqueBasesMap.values());

      const promises = [];

      const castedProjectList = uniqueBases
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
    opts?: { includeDeleted?: boolean; includeSnapshot?: boolean },
    ncMeta = Noco.ncMeta,
  ) {
    const { includeDeleted = false, includeSnapshot = false } = opts || {};

    const baseListQb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.*`)
      .where(`${MetaTable.PROJECT}.fk_workspace_id`, fk_workspace_id);

    if (!includeSnapshot) {
      // exclude only if is_snapshot = true
      baseListQb.where((qb) => {
        qb.where(`${MetaTable.PROJECT}.is_snapshot`, false).orWhereNull(
          `${MetaTable.PROJECT}.is_snapshot`,
        );
      });
    }

    if (!includeDeleted) {
      baseListQb.where((qb) => {
        qb.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      });
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
