import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';

export default class Sandbox {
  id: string;
  fk_workspace_id: string;
  master_base_id: string;
  sandbox_base_id: string;
  created_by: string;
  meta?: Record<string, any> | string;
  created_at: string;
  updated_at: string;

  constructor(sandbox: Partial<Sandbox>) {
    Object.assign(this, sandbox);
  }

  public static async get(
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    let sandbox = await NocoCache.get(
      'root',
      `${CacheScope.SANDBOX}:${sandboxId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!sandbox) {
      sandbox = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SANDBOXES,
        sandboxId,
      );

      if (!sandbox) return null;

      sandbox = prepareForResponse(sandbox);

      await NocoCache.set(
        'root',
        `${CacheScope.SANDBOX}:${sandboxId}`,
        sandbox,
      );
    }

    return new Sandbox(sandbox);
  }

  // Each sandbox belongs to a unique master hence returns single record
  public static async getBySandboxBaseId(
    sandboxBaseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    const sandboxes = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        xcCondition: {
          _and: [{ sandbox_base_id: { eq: sandboxBaseId } }],
        },
      },
    );

    if (!sandboxes || sandboxes.length === 0) return null;

    return new Sandbox(prepareForResponse(sandboxes[0]));
  }

  public static async listByMasterBaseId(
    masterBaseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox[]> {
    const sandboxes = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        xcCondition: {
          _and: [{ master_base_id: { eq: masterBaseId } }],
        },
        orderBy: { created_at: 'desc' },
      },
    );

    if (!sandboxes || sandboxes.length === 0) return [];

    return sandboxes.map((sandbox) => new Sandbox(prepareForResponse(sandbox)));
  }

  public static async insert(
    context: NcContext,
    sandbox: Partial<Sandbox>,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    const insertObj = extractProps(sandbox, [
      'master_base_id',
      'sandbox_base_id',
      'fk_workspace_id',
      'created_by',
      'meta',
    ]);

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      prepareForDb(insertObj),
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    sandboxId: string,
    sandbox: Partial<Sandbox>,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    const updateObj = extractProps(sandbox, ['meta']);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      prepareForDb(updateObj),
      sandboxId,
    );

    await NocoCache.del('root', `${CacheScope.SANDBOX}:${sandboxId}`);

    return this.get(sandboxId, ncMeta);
  }

  public static async delete(
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      sandboxId,
    );

    await NocoCache.del('root', `${CacheScope.SANDBOX}:${sandboxId}`);

    return true;
  }
}
