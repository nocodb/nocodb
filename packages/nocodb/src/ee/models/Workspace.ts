import type { WorkspaceType } from 'nocodb-sdk';
import type { WorkspacePlan, WorkspaceStatus } from 'nocodb-sdk';
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
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
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

    const workspace = await this.get(id);

    if (!workspace) NcError.notFound('Workspace not found');

    // get existing cache
    const key = `${CacheScope.WORKSPACE}:${id}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    // extract props which is allowed to be inserted
    const updateObject = extractProps(workspaceAttr, [
      'title',
      'description',
      'meta',
      'deleted',
      'deleted_at',
      'order',
    ]);

    // stringify meta if it is an object
    if ('meta' in updateObject && typeof updateObject.meta === 'object') {
      updateObject.meta = JSON.stringify(updateObject.meta);
    }

    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE,
      updateObject,
      id,
    );

    // update cache after successful update
    if (o) {
      Object.assign(o, updateObject);
      // set cache
      await NocoCache.set(key, o);
    }
    return res;
  }

  public static async updateStatusAndPlan(
    id: string,
    workspace: Partial<Workspace>,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.WORKSPACE}:${id}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

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
      {
        ...updateObject,
        // stringify infra_meta if it is an object
        infra_meta: stringifyMetaProp(updateObject, 'infra_meta'),
      },
      id,
    );

    // update cache after successful update
    if (o) {
      Object.assign(o, updateObject);
      // set cache
      await NocoCache.set(key, o);
    }
    return res;
  }

  public static async delete(id: string, ncMeta = Noco.ncMeta) {
    if (!id) NcError.badRequest('Workspace id is required');

    const workspace = await this.get(id, ncMeta);

    if (!workspace) NcError.notFound('Workspace not found');

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

    const workspace = await this.get(id);

    if (!workspace) NcError.notFound('Workspace not found');

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
}
