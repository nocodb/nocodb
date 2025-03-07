import { Logger } from '@nestjs/common';
import {
  ProjectRoles,
  type WorkspacePlan,
  type WorkspaceStatus,
  type WorkspaceType,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
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
  Plan,
  Subscription,
} from '~/models';
import { FreePlan } from '~/models/Plan';

const logger = new Logger('Workspace');

const NON_SEAT_ROLES = [
  WorkspaceUserRoles.NO_ACCESS,
  WorkspaceUserRoles.VIEWER,
  WorkspaceUserRoles.COMMENTER,
  ProjectRoles.NO_ACCESS,
  ProjectRoles.VIEWER,
  ProjectRoles.COMMENTER,
];

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

  payment?: {
    subscription?: Subscription;
    plan: Partial<Plan>;
  };

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

    workspace.payment = await this.getActivePlanAndSubscription(workspace.id);

    return workspace && new Workspace(workspace);
  }

  public static async get(
    workspaceId: string,
    force = false,
    ncMeta = Noco.ncMeta,
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
        workspaceData.payment = await this.getActivePlanAndSubscription(
          workspaceData.id,
        );
        if (!workspaceData.deleted) {
          await NocoCache.set(
            `${CacheScope.WORKSPACE}:${workspaceData.id}`,
            workspaceData,
          );
        }
      }
    }

    if (workspaceData?.deleted && !force) return undefined;

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
    ]);

    // stringify meta if it is an object
    if ('meta' in updateObject && typeof updateObject.meta === 'object') {
      updateObject.meta = JSON.stringify(updateObject.meta);
    }

    const res = await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      prepareForDb(updateObject),
      id,
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
        condition: {
          deleted: false,
        },
      },
    );

    for (const workspace of workspaces) {
      workspace.meta = parseMetaProp(workspace);
      workspace.infra_meta = parseMetaProp(workspace, 'infra_meta');
      workspace.payment = await this.getActivePlanAndSubscription(workspace.id);
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

    for (const workspace of workspaces) {
      workspace.payment = await this.getActivePlanAndSubscription(workspace.id);
    }

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

  public static async getActivePlanAndSubscription(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const subscription = await Subscription.getByWorkspace(workspaceId, ncMeta);

    if (!subscription) return { plan: FreePlan };

    const plan = await Plan.get(subscription.fk_plan_id, ncMeta);

    return { plan, subscription };
  }

  public static async refreshPlanAndSubscription(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const workspace = await this.get(workspaceId, true, ncMeta);

    if (!workspace) return;

    await NocoCache.update(`${CacheScope.WORKSPACE}:${workspaceId}`, {
      payment: await this.getActivePlanAndSubscription(workspaceId),
    });
  }

  public static async getSeatCount(workspaceId: string, ncMeta = Noco.ncMeta) {
    const workspaceUsers = await ncMeta.metaList2(
      workspaceId,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        condition: {
          fk_workspace_id: workspaceId,
          deleted: false,
        },
      },
    );

    const baseUsers = await ncMeta.metaList2(
      workspaceId,
      RootScopes.WORKSPACE,
      MetaTable.PROJECT_USERS,
      {
        condition: {
          fk_workspace_id: workspaceId,
        },
      },
    );

    /*
      Count users based on their roles in either workspace or base
      and exclude users with roles that do not consume a seat
    */
    const seatUsersMap = new Map<string, true>();

    for (const user of workspaceUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }
    }

    for (const user of baseUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }
    }

    return seatUsersMap.size;
  }
}
