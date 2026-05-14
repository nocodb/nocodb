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

/**
 * Sentinel value cached against `sandbox_base_id` lookups when the base
 * isn't a sandbox. Lets `getBySandboxBaseId` short-circuit on production
 * bases instead of re-querying the DB on every traced op.
 *
 * Must be a serializable value the cache layer round-trips faithfully —
 * a primitive sentinel string is safer than `null`/`undefined` since the
 * "no entry" cache miss is also represented as falsy.
 */
const SANDBOX_NEGATIVE_MARKER = '__nc_no_sandbox__';

export default class Sandbox {
  id: string;
  fk_workspace_id: string;
  production_base_id: string;
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

  // Each sandbox belongs to a unique production base hence returns single record
  public static async getBySandboxBaseId(
    sandboxBaseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    const cacheKey = `${CacheScope.SANDBOX}:sandbox_base_id:${sandboxBaseId}`;
    let sandbox = await NocoCache.get(
      'root',
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );

    // Negative-cache hit: this base has been confirmed as not-a-sandbox.
    // Avoids re-querying on every traced op (e.g. `recordCommand` calls this
    // for every @TraceCommand invocation, including non-sandbox bases).
    if (sandbox === SANDBOX_NEGATIVE_MARKER) return null;

    if (!sandbox) {
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

      if (!sandboxes || sandboxes.length === 0) {
        // Cache the negative so subsequent traced ops on a production base
        // hit the cache instead of the DB. Cleared by the same invalidation
        // that would clear a positive entry (sandbox create / merge / delete).
        await NocoCache.set('root', cacheKey, SANDBOX_NEGATIVE_MARKER);
        return null;
      }

      sandbox = prepareForResponse(sandboxes[0]);

      await NocoCache.set('root', cacheKey, sandbox);

      // Also populate primary cache
      await NocoCache.set(
        'root',
        `${CacheScope.SANDBOX}:${sandbox.id}`,
        sandbox,
      );
    }

    return new Sandbox(sandbox);
  }

  public static async listByProductionBaseId(
    productionBaseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox[]> {
    const sandboxes = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        xcCondition: {
          _and: [{ production_base_id: { eq: productionBaseId } }],
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
      'production_base_id',
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

    // Bust the negative cache: a traced op may have populated
    // `SANDBOX_NEGATIVE_MARKER` against this base before the sandbox existed.
    if (insertObj.sandbox_base_id) {
      await NocoCache.del(
        'root',
        `${CacheScope.SANDBOX}:sandbox_base_id:${insertObj.sandbox_base_id}`,
      );
    }

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
    // Fetch before deletion to clear secondary cache key
    const existing = await this.get(sandboxId, ncMeta);

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      sandboxId,
    );

    await NocoCache.del('root', `${CacheScope.SANDBOX}:${sandboxId}`);

    if (existing?.sandbox_base_id) {
      await NocoCache.del(
        'root',
        `${CacheScope.SANDBOX}:sandbox_base_id:${existing.sandbox_base_id}`,
      );
    }

    return true;
  }
}
