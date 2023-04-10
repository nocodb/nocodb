import { extractProps } from '../helpers/extractProps';
import Noco from '../Noco';
import { MetaTable } from '../utils/globals';

// import Page from './Page';
import type { WorkspaceType } from 'nocodb-sdk';

export default class Workspace implements WorkspaceType {
  id?: string;
  title?: string;
  description?: string;

  meta?: string | Record<string, any>;

  fk_user_id?: string;

  deleted?: boolean;
  deleted_at?: Date | string | number;
  order?: number;

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
    const workspace = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.WORKSPACE,
      workspaceId,
    );
    if (workspace.meta && typeof workspace.meta === 'string') {
      try {
        workspace.meta = JSON.parse(workspace.meta);
      } catch {
        workspace.meta = {};
      }
    }
    return workspace && new Workspace(workspace);
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

    // await Page.createPageTable({
    //   workspaceId: id,
    // } as any);

    return this.get(id);
  }

  public static async update(
    id: string,
    workspace: Partial<Workspace>,
    ncMeta = Noco.ncMeta,
  ) {
    // extract props which is allowed to be inserted
    const updateObject = extractProps(workspace, [
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

    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE,
      updateObject,
      id,
    );
  }

  public static async delete(id: string, ncMeta = Noco.ncMeta) {
    // todo: delete from workspace user
    await ncMeta.metaDelete(null, null, MetaTable.WORKSPACE_USER, {
      fk_workspace_id: id,
    });

    // todo: reset project workspace mapping
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

    return await ncMeta.metaDelete(null, null, MetaTable.WORKSPACE, id);
  }

  public static async softDelete(id: string, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE,
      {
        deleted: true,
        deleted_at: Date.now(),
      },
      id,
    );
  }

  static async list(ncMeta = Noco.ncMeta) {
    const workspaces = await ncMeta.metaList(null, null, MetaTable.WORKSPACE);
    return workspaces.map((workspace) => {
      if (workspace.meta && typeof workspace.meta === 'string') {
        try {
          workspace.meta = JSON.parse(workspace.meta);
        } catch {
          workspace.meta = {};
        }
      }
      new Workspace(workspace);
    });
  }
}
