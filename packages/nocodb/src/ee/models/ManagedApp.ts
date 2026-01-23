import { BaseVersion, ManagedAppVisibility } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { Base } from '~/models';

export default class ManagedApp {
  id: string;
  base_id: string;
  fk_workspace_id: string;

  title: string;
  description?: string;

  // Owner of the managed app
  created_by: string;

  // Visibility in app store
  visibility: ManagedAppVisibility;

  // Category for filtering in app store
  category?: string;

  // Installation/usage stats
  install_count: number;

  // Metadata (screenshots, documentation, etc.)
  meta?: Record<string, any> | string;

  // Soft delete
  deleted: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;

  constructor(managedApp: Partial<ManagedApp>) {
    Object.assign(this, managedApp);
  }

  public static async get(
    managedAppId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedApp> {
    let managedApp = await NocoCache.get(
      'root',
      `${CacheScope.MANAGED_APP}:${managedAppId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!managedApp) {
      // Use RootScopes.ROOT for global scope query with workspace filtering via xcCondition
      managedApp = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.MANAGED_APPS,
        managedAppId,
        null,
        {
          _and: [
            {
              deleted: {
                eq: false,
              },
            },
          ],
        },
      );

      if (!managedApp) return null;

      managedApp = prepareForResponse(managedApp);

      await NocoCache.set(
        'root',
        `${CacheScope.MANAGED_APP}:${managedAppId}`,
        managedApp,
      );
    }

    return new ManagedApp(managedApp);
  }

  public static async getByBaseId(
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedApp> {
    const managedApps = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      {
        xcCondition: {
          _and: [{ base_id: { eq: baseId } }, { deleted: { eq: false } }],
        },
      },
    );

    if (!managedApps || managedApps.length === 0) return null;

    return new ManagedApp(prepareForResponse(managedApps[0]));
  }

  public static async list(
    args?: {
      workspaceId?: string;
      userId?: string;
      visibility?: ManagedAppVisibility;
      category?: string;
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedApp[]> {
    const conditions: any[] = [
      { fk_workspace_id: { eq: args?.workspaceId } },
      { deleted: { eq: false } },
    ];

    if (args?.userId) {
      conditions.push({ created_by: { eq: args.userId } });
    }

    if (args?.visibility) {
      conditions.push({ visibility: { eq: args.visibility } });
    }

    if (args?.category) {
      conditions.push({ category: { eq: args.category } });
    }

    const managedAppList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      {
        xcCondition: {
          _and: conditions,
        },
        limit: args?.limit,
        offset: args?.offset,
        orderBy: {
          created_at: 'desc',
        },
      },
    );

    return managedAppList.map(
      (managedApp) => new ManagedApp(prepareForResponse(managedApp)),
    );
  }

  public static async listPublished(
    args?: {
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
      userId?: string;
      workspaceId?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedApp[]> {
    const xcCondition: any = {
      _and: [
        { published_at: { neq: null } }, // Has been published
        { deleted: { eq: false } },
      ],
    };

    // Visibility filtering:
    // - Public: visible to everyone
    // - Private: visible to users in the same workspace
    // - Unlisted: visible only to the owner
    const visibilityConditions: any[] = [
      { visibility: { eq: ManagedAppVisibility.PUBLIC } },
    ];

    if (args?.workspaceId) {
      visibilityConditions.push({
        _and: [
          { visibility: { eq: ManagedAppVisibility.PRIVATE } },
          { fk_workspace_id: { eq: args.workspaceId } },
        ],
      });
    }

    if (args?.userId) {
      visibilityConditions.push({
        _and: [
          { visibility: { eq: ManagedAppVisibility.UNLISTED } },
          { created_by: { eq: args.userId } },
        ],
      });
    }

    xcCondition._and.push({ _or: visibilityConditions });

    if (args?.category) {
      xcCondition._and.push({ category: { eq: args.category } });
    }

    if (args?.search) {
      xcCondition._and.push({
        _or: [
          { title: { like: `%${args.search}%` } },
          { description: { like: `%${args.search}%` } },
        ],
      });
    }

    // Use RootScopes.ROOT for global scope query
    const managedAppList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      {
        xcCondition,
        limit: args?.limit,
        offset: args?.offset,
        orderBy: {
          install_count: 'desc',
          created_at: 'desc',
        },
      },
    );

    return managedAppList.map(
      (managedApp) => new ManagedApp(prepareForResponse(managedApp)),
    );
  }

  public static async insert(
    context: NcContext,
    managedApp: Partial<ManagedApp>,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedApp> {
    // Validate base exists and is V3
    const base = await Base.get(context, managedApp.base_id);
    if (!base) {
      NcError.get(context).baseNotFound(managedApp.base_id);
    }

    if (base.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        `Only V3 bases can be published as managed apps`,
      );
    }

    const insertObj = extractProps(managedApp, [
      'title',
      'description',
      'base_id',
      'created_by',
      'fk_workspace_id',
      'visibility',
      'category',
      'meta',
    ]);

    // Set defaults
    insertObj.visibility = insertObj.visibility || ManagedAppVisibility.PRIVATE;
    insertObj.install_count = 0;

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      prepareForDb(insertObj),
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    managedAppId: string,
    managedApp: Partial<ManagedApp>,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedApp> {
    const updateObj = extractProps(managedApp, [
      'title',
      'description',
      'visibility',
      'category',
      'meta',
      'published_at',
    ]);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      prepareForDb(updateObj),
      managedAppId,
    );

    await NocoCache.del('root', `${CacheScope.MANAGED_APP}:${managedAppId}`);

    return this.get(managedAppId, ncMeta);
  }

  public static async softDelete(
    managedAppId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      { deleted: true },
      managedAppId,
    );

    await NocoCache.del('root', `${CacheScope.MANAGED_APP}:${managedAppId}`);

    return true;
  }

  public static async delete(
    managedAppId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    // Hard delete - use softDelete instead for normal operations
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      managedAppId,
    );

    await NocoCache.del('root', `${CacheScope.MANAGED_APP}:${managedAppId}`);

    return true;
  }

  public static async incrementInstallCount(
    managedAppId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APPS,
      {
        install_count: ncMeta.knex.raw('install_count + 1'),
      },
      managedAppId,
    );

    await NocoCache.del('root', `${CacheScope.MANAGED_APP}:${managedAppId}`);
  }
}
