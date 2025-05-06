import { Logger } from '@nestjs/common';
import {
  NON_SEAT_ROLES,
  PlanLimitTypes,
  type WorkspacePlan,
  type WorkspaceStatus,
  type WorkspaceType,
} from 'nocodb-sdk';
import type { Plan, Subscription } from '~/models';
import { MCPToken } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';

import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';
import {
  Base,
  CustomUrl,
  DataReflection,
  Integration,
  ModelStat,
  UsageStat,
} from '~/models';
import { getActivePlanAndSubscription } from '~/helpers/paymentHelpers';

const logger = new Logger('Workspace');

export default class Workspace implements WorkspaceType {
  id?: string;
  title?: string;
  description?: string;

  meta?: string | Record<string, any>;

  fk_user_id?: string;

  deleted?: boolean;
  deleted_at?: Date | string | number;
  order?: number;

  plan?: WorkspacePlan;
  status?: WorkspaceStatus;
  message?: string;
  infra_meta?: string | Record<string, any>;
  fk_org_id?: string;
  stripe_customer_id?: string;

  payment?: {
    subscription?: Subscription;
    plan: Partial<Plan>;
  };

  stats?: {
    [key: string]: number;
  };

  // grace periods allow non-paid users to overuse their limits for a certain period before they are blocked
  // grace_period_start_at tracks record & storage limits and it will be reset if they go below the limit
  // api_grace_period_start_at tracks api limits and it will never be reset
  // automation_grace_period_start_at tracks automation limits and it will never be reset
  grace_period_start_at?: string;
  api_grace_period_start_at?: string;
  automation_grace_period_start_at?: string;

  loyal?: boolean;
  loyalty_discount_used?: boolean;

  created_at?: string;
  updated_at?: string;

  constructor(workspace: Workspace | WorkspaceType) {
    Object.assign(this, workspace);
  }

  public static async getByTitle({
    title,
    ncMeta = Noco.ncMeta,
  }: {
    title: string;
    ncMeta?: any;
  }): Promise<Workspace | undefined> {
    const workspace = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        title,
      },
    );
    if (workspace?.meta && typeof workspace.meta === 'string') {
      try {
        workspace.meta = JSON.parse(workspace.meta);
      } catch {
        workspace.meta = {};
      }
    }

    workspace.payment = await getActivePlanAndSubscription(
      workspace.fk_org_id || workspace.id,
      ncMeta,
    );

    return workspace && new Workspace(workspace);
  }

  public static async get(
    workspaceId: string,
    force = false,
    ncMeta = Noco.ncMeta,
    withStats = true,
  ) {
    let workspaceData = await NocoCache.get(
      `${CacheScope.WORKSPACE}:${workspaceId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!workspaceData) {
      workspaceData = await ncMeta.metaGet2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE,
        {
          id: workspaceId,
        },
      );
      if (workspaceData) {
        workspaceData.meta = parseMetaProp(workspaceData);
        workspaceData.infra_meta = parseMetaProp(workspaceData, 'infra_meta');
        if (!workspaceData.deleted) {
          await NocoCache.set(
            `${CacheScope.WORKSPACE}:${workspaceData.id}`,
            workspaceData,
          );
        }
      }
    }

    if (!workspaceData || (workspaceData?.deleted && !force)) return undefined;

    workspaceData.payment = await getActivePlanAndSubscription(
      workspaceData.fk_org_id || workspaceData.id,
      ncMeta,
    );

    if (withStats) {
      const periodStats = await UsageStat.getPeriodStats(
        workspaceData.id,
        workspaceData.payment?.subscription?.billing_cycle_anchor ||
          workspaceData.created_at,
        ncMeta,
      );

      const resourceStats = await this.getResourceStats(
        workspaceData.id,
        ncMeta,
      );

      const storageStats = await this.getStorageStats(workspaceData.id, ncMeta);

      const recordStats = await ModelStat.getWorkspaceSum(workspaceData.id);

      workspaceData.stats = {
        ...periodStats,
        ...resourceStats,
        ...storageStats,
        ...recordStats,
      };
    }

    return workspaceData && new Workspace(workspaceData);
  }

  public static async insert(
    workspace: Partial<Workspace>,
    ncMeta = Noco.ncMeta,
  ) {
    // extract props which is allowed to be inserted
    const insertObject = extractProps(workspace, [
      'id',
      'title',
      'description',
      'meta',
      'fk_user_id',
      'deleted',
      'deleted_at',
      'order',
      'status',
      'plan',
      'fk_org_id',
      'stripe_customer_id',
      'grace_period_start_at',
      'loyal',
      'loyalty_discount_used',
    ]);

    // stringify meta if it is an object
    if ('meta' in insertObject && typeof insertObject.meta === 'object') {
      insertObject.meta = JSON.stringify(insertObject.meta);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      insertObject,
    );

    /* TODO - enable when docs are ready
      await Page.createPageTable({
        workspaceId: id,
      } as any);
    */

    return this.get(id, false, ncMeta);
  }

  public static async update(
    id: string,
    workspaceAttr: Partial<Workspace>,
    ncMeta = Noco.ncMeta,
    updateCreatedAt = false,
  ) {
    if (!id) NcError.badRequest('Workspace id is required');

    const workspace = await this.get(id, false, ncMeta);

    if (!workspace) NcError.workspaceNotFound(id);

    // extract props which is allowed to be inserted
    const updateObject = extractProps(workspaceAttr, [
      'title',
      'description',
      'meta',
      'deleted',
      'deleted_at',
      'order',
      'fk_org_id',
      'stripe_customer_id',
      'grace_period_start_at',
      'loyal',
      'loyalty_discount_used',
    ]);

    // stringify meta if it is an object
    if ('meta' in updateObject && typeof updateObject.meta === 'object') {
      updateObject.meta = JSON.stringify(updateObject.meta);
    }

    if (updateCreatedAt) {
      updateObject.created_at = ncMeta.now();
    }

    const res = await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      prepareForDb(updateObject),
      id,
      undefined,
      false,
      false,
      // allow created_at to be updated (required for updating seed workspaces when changing owner)
      true,
    );

    // update cache after successful update
    await NocoCache.update(
      `${CacheScope.WORKSPACE}:${id}`,
      prepareForResponse(updateObject),
    );

    return res;
  }

  public static async updateStatusAndPlan(
    id: string,
    workspace: Partial<Workspace>,
    ncMeta = Noco.ncMeta,
  ) {
    // extract props which is allowed to be inserted
    const updateObject = extractProps(workspace, [
      'status',
      'plan',
      'infra_meta',
    ]);

    const res = await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      prepareForDb(updateObject, 'infra_meta'),
      id,
    );

    // update cache after successful update
    await NocoCache.update(
      `${CacheScope.WORKSPACE}:${id}`,
      prepareForResponse(updateObject, 'infra_meta'),
    );

    return res;
  }

  public static async delete(id: string, ncMeta = Noco.ncMeta) {
    if (!id) NcError.badRequest('Workspace id is required');

    const workspace = await this.get(id, true, ncMeta);

    if (!workspace) NcError.workspaceNotFound(id);

    await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        fk_workspace_id: id,
      },
    );

    await NocoCache.deepDel(
      `${CacheScope.WORKSPACE_USER}:${id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    // Delete data reflection configuration if exists
    await DataReflection.destroy(id, ncMeta);

    const bases = await Base.listByWorkspace(id, true, ncMeta);

    for (const base of bases) {
      await Base.delete(
        {
          workspace_id: id,
          base_id: base.id,
        },
        base.id,
        ncMeta,
      );
    }

    // TODO: THIS LOOKS UNNECESSARY AS WE ARE DELETING BASES ABOVE - CHECK
    await ncMeta.metaUpdate(
      RootScopes.BASE,
      RootScopes.BASE,
      MetaTable.PROJECT,
      {
        fk_workspace_id: null,
        deleted: true,
      },
      {
        fk_workspace_id: id,
      },
    );

    const integrations = await ncMeta.metaList2(
      workspace.id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        condition: {
          fk_workspace_id: workspace.id,
        },
      },
    );

    for (const int of integrations) {
      const integration = new Integration(int);
      await integration.delete(ncMeta);
    }

    await NocoCache.del(`${CacheScope.WORKSPACE}:${id}`);

    CustomUrl.bulkDelete({ fk_workspace_id: id }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of workspaceId: ${id}`);
    });

    return await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      id,
    );
  }

  public static async softDelete(id: string, ncMeta = Noco.ncMeta) {
    if (!id) NcError.badRequest('Workspace id is required');

    const workspace = await this.get(id, false, ncMeta);

    if (!workspace) NcError.workspaceNotFound(id);

    // Delete data reflection configuration if exists
    await DataReflection.destroy(id, ncMeta);

    await NocoCache.del(`${CacheScope.WORKSPACE}:${id}`);

    CustomUrl.bulkDelete({ fk_workspace_id: id }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of workspaceId: ${id}`);
    });

    MCPToken.bulkDelete({ fk_workspace_id: id }, ncMeta).catch(() => {
      logger.error(`Failed to delete mcp tokens of workspaceId: ${id}`);
    });

    return await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        deleted: true,
        deleted_at: ncMeta.knex.fn.now(),
      },
      id,
    );
  }

  static async list(ncMeta = Noco.ncMeta) {
    const workspaces = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        xcCondition: {
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
      },
    );

    for (const workspace of workspaces) {
      workspace.meta = parseMetaProp(workspace);
      workspace.infra_meta = parseMetaProp(workspace, 'infra_meta');
    }

    return workspaces.map((workspace) => new Workspace(workspace));
  }

  static async count(condition: any, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaCount(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        condition: { ...condition, deleted: false },
      },
    );
  }

  static async listByOrgId(param: { orgId: string }, ncMeta = Noco.ncMeta) {
    const queryBuilder = ncMeta
      .knex(MetaTable.WORKSPACE)
      .select(
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.meta`,
        ncMeta.knex.raw(`JSON_AGG(
        DISTINCT JSON_BUILD_OBJECT(
          'id', ${MetaTable.WORKSPACE_USER}.fk_user_id,
          'display_name', ${MetaTable.USERS}.display_name,
          'email', ${MetaTable.USERS}.email,
          'main_roles', ${MetaTable.USERS}.roles,
          'meta', ${MetaTable.USERS}.meta,
          'roles', ${MetaTable.WORKSPACE_USER}.roles,
          'created_at', ${MetaTable.WORKSPACE_USER}.created_at
        )::TEXT
      ) as members`),
        ncMeta.knex.raw(`JSON_AGG(
        DISTINCT JSON_BUILD_OBJECT(
          'id', ${MetaTable.PROJECT}.id, 
          'title', ${MetaTable.PROJECT}.title,
          'created_at', ${MetaTable.PROJECT}.created_at,
          'updated_at', ${MetaTable.PROJECT}.updated_at,
          'meta', ${MetaTable.PROJECT}.meta
        )::TEXT
      ) as bases`),
      )
      .innerJoin(
        MetaTable.WORKSPACE_USER,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .innerJoin(
        MetaTable.USERS,
        `${MetaTable.USERS}.id`,
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
      )
      .leftJoin(
        MetaTable.PROJECT,
        `${MetaTable.PROJECT}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .where((kn) => {
        kn.where(`${MetaTable.WORKSPACE}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE}.deleted`,
        );
        kn.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE_USER}.deleted`,
        );
      })
      .andWhere(`${MetaTable.WORKSPACE}.fk_org_id`, param.orgId)
      .groupBy(
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.meta`,
      );

    const workspaces = await queryBuilder;

    return workspaces;
  }

  static async updateOrgId(
    param: { id: string; orgId: any },
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        fk_org_id: param.orgId,
        // stringify infra_meta if it is an object
      },
      param.id,
    );

    await NocoCache.update(`${CacheScope.WORKSPACE}:${param.id}`, {
      fk_org_id: param.orgId,
    });

    return res;
  }

  public static async getFirstWorkspace(ncMeta = Noco.ncMeta) {
    // todo: add cache
    const workspace = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        deleted: false,
      },
    );

    return workspace;
  }

  public static async getResourceStats(id: string, ncMeta = Noco.ncMeta) {
    let stats = await NocoCache.getHash(
      `${CacheScope.RESOURCE_STATS}:workspace:${id}`,
    );
    if (!stats) {
      stats = await ncMeta.knexConnection
        .select({
          [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: ncMeta
            .knexConnection(MetaTable.HOOKS)
            .count('*')
            .where('fk_workspace_id', id),
          [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: ncMeta
            .knexConnection(MetaTable.EXTENSIONS)
            .count('*')
            .where('fk_workspace_id', id),
          [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: ncMeta
            .knexConnection(MetaTable.SNAPSHOT)
            .count('*')
            .where('fk_workspace_id', id),
          [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: ncMeta
            .knexConnection(MetaTable.SOURCES)
            .count('*')
            .where('fk_workspace_id', id)
            .where((qb) => {
              qb.where('is_meta', false).orWhereNull('is_meta');
            })
            .where((qb) => {
              qb.where('is_local', false).orWhereNull('is_local');
            }),
          [PlanLimitTypes.LIMIT_EDITOR]: ncMeta
            .knexConnection(`${MetaTable.WORKSPACE_USER} AS wu`)
            .leftJoin(
              `${MetaTable.PROJECT_USERS} AS bu`,
              'wu.fk_user_id',
              'bu.fk_user_id',
            )
            .countDistinct('wu.fk_user_id')
            .where('wu.fk_workspace_id', id)
            .andWhere((qb) => {
              qb.whereNotIn('wu.roles', NON_SEAT_ROLES).orWhereNotIn(
                'bu.roles',
                NON_SEAT_ROLES,
              );
            }),
          [PlanLimitTypes.LIMIT_COMMENTER]: ncMeta
            .knexConnection(`${MetaTable.WORKSPACE_USER} AS wu`)
            .leftJoin(
              `${MetaTable.PROJECT_USERS} AS bu`,
              'wu.fk_user_id',
              'bu.fk_user_id',
            )
            .countDistinct('wu.fk_user_id')
            .where('wu.fk_workspace_id', id)
            .whereNotIn('wu.fk_user_id', function () {
              this.select('wu2.fk_user_id')
                .from(`${MetaTable.WORKSPACE_USER} AS wu2`)
                .join(
                  `${MetaTable.PROJECT_USERS} AS bu2`,
                  'wu2.fk_user_id',
                  'bu2.fk_user_id',
                )
                .where('wu2.fk_workspace_id', id)
                .andWhere((qb) => {
                  qb.whereNotIn('wu2.roles', NON_SEAT_ROLES).orWhereNotIn(
                    'bu2.roles',
                    NON_SEAT_ROLES,
                  );
                });
            }),
        })
        .first();

      if (stats) {
        stats = Object.fromEntries(
          Object.entries(stats).map(([key, value]) => {
            return [key, +value];
          }),
        );

        await NocoCache.setHash(
          `${CacheScope.RESOURCE_STATS}:workspace:${id}`,
          stats,
        );
      }
    }

    return Object.fromEntries(
      Object.entries(stats).map(([key, value]) => {
        return [key, +value];
      }),
    );
  }

  public static async getStorageStats(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: number;
  }> {
    let storage = await NocoCache.getHash(
      `${CacheScope.STORAGE_STATS}:workspace:${id}`,
    );

    if (!storage) {
      storage = await ncMeta.knexConnection
        .select({
          [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: ncMeta
            .knexConnection(MetaTable.FILE_REFERENCES)
            .sum('file_size')
            .where('fk_workspace_id', id)
            .where('deleted', false),
        })
        .first();

      if (
        !storage ||
        storage[PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE] === null ||
        storage[PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE] === undefined
      ) {
        storage = {
          [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 0,
        };
      }

      await NocoCache.setHash(
        `${CacheScope.STORAGE_STATS}:workspace:${id}`,
        storage,
      );
    }

    // convert bytes to MB
    return {
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: Math.floor(
        +storage[PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE] / 1000 / 1000,
      ),
    };
  }
}
