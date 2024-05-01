import type { WorkspacePlan, WorkspaceStatus, WorkspaceType } from 'nocodb-sdk';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';
import { Base } from '~/models';

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
    const workspace = await ncMeta.metaGet2(null, null, MetaTable.WORKSPACE, {
      title,
    });
    if (workspace?.meta && typeof workspace.meta === 'string') {
      try {
        workspace.meta = JSON.parse(workspace.meta);
      } catch {
        workspace.meta = {};
      }
    }
    return workspace && new Workspace(workspace);
  }

  public static async get(workspaceId: string, ncMeta = Noco.ncMeta) {
    let workspaceData = await NocoCache.get(
      `${CacheScope.WORKSPACE}:${workspaceId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!workspaceData) {
      workspaceData = await ncMeta.metaGet2(null, null, MetaTable.WORKSPACE, {
        id: workspaceId,
        deleted: false,
      });
      if (workspaceData) {
        workspaceData.meta = parseMetaProp(workspaceData);
        workspaceData.infra_meta = parseMetaProp(workspaceData, 'infra_meta');
        await NocoCache.set(
          `${CacheScope.WORKSPACE}:${workspaceData.id}`,
          workspaceData,
        );
      }
    }

    if (workspaceData?.deleted) return undefined;

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
      null,
      null,
      MetaTable.WORKSPACE,
      insertObject,
    );

    /* TODO - enable when docs are ready
      await Page.createPageTable({
        workspaceId: id,
      } as any);
    */

    return this.get(id);
  }

  public static async update(
    id: string,
    workspaceAttr: Partial<Workspace>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!id) NcError.badRequest('Workspace id is required');

    const workspace = await this.get(id, ncMeta);

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
      null,
      null,
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
      null,
      null,
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

    const workspace = await this.get(id, ncMeta);

    if (!workspace) NcError.workspaceNotFound(id);

    await ncMeta.metaDelete(null, null, MetaTable.WORKSPACE_USER, {
      fk_workspace_id: id,
    });

    await NocoCache.deepDel(
      `${CacheScope.WORKSPACE_USER}:${id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    const bases = await Base.listByWorkspace(id, ncMeta);

    for (const base of bases) {
      await Base.delete(base.id, ncMeta);
    }

    // todo: reset base workspace mapping
    // and mark it as deleted
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.PROJECT,
      {
        fk_workspace_id: null,
        deleted: true,
      },
      {
        fk_workspace_id: id,
      },
    );

    await NocoCache.del(`${CacheScope.WORKSPACE}:${id}`);

    return await ncMeta.metaDelete(null, null, MetaTable.WORKSPACE, id);
  }

  public static async softDelete(id: string, ncMeta = Noco.ncMeta) {
    if (!id) NcError.badRequest('Workspace id is required');

    const workspace = await this.get(id, ncMeta);

    if (!workspace) NcError.workspaceNotFound(id);

    await NocoCache.del(`${CacheScope.WORKSPACE}:${id}`);

    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE,
      {
        deleted: true,
        deleted_at: ncMeta.knex.fn.now(),
      },
      id,
    );
  }

  static async list(ncMeta = Noco.ncMeta) {
    const workspaces = await ncMeta.metaList(null, null, MetaTable.WORKSPACE, {
      condition: {
        deleted: false,
      },
    });
    return workspaces.map((workspace) => {
      workspace.meta = parseMetaProp(workspace);
      workspace.infra_meta = parseMetaProp(workspace, 'infra_meta');
      new Workspace(workspace);
    });
  }

  static async count(condition: any, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaCount(null, null, MetaTable.WORKSPACE, {
      condition: { ...condition, deleted: false },
    });
  }

  static async listByOrgId(param: { orgId: string }, ncMeta = Noco.ncMeta) {
    const queryBuilder = await ncMeta
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
      .where({
        [`${MetaTable.WORKSPACE}.deleted`]: false,
        [`${MetaTable.WORKSPACE_USER}.deleted`]: false,
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
      null,
      null,
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
}
