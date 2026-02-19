import { ManagedAppVersionStatus } from 'nocodb-sdk';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class ManagedAppVersion {
  id?: string;
  fk_managed_app_id: string;
  version: string;
  version_number: number;
  status: ManagedAppVersionStatus;
  fk_workspace_id: string;
  schema: string; // Serialized schema JSON
  release_notes?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;

  constructor(data: Partial<ManagedAppVersion>) {
    Object.assign(this, data);
  }

  public static async get(
    managedAppVersionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedAppVersion> {
    let managedAppVersion =
      managedAppVersionId &&
      (await NocoCache.get(
        'root',
        `${CacheScope.MANAGED_APP_VERSION}:${managedAppVersionId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!managedAppVersion) {
      managedAppVersion = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.MANAGED_APP_VERSIONS,
        managedAppVersionId,
      );

      if (!managedAppVersion) return null;

      managedAppVersion = prepareForResponse(managedAppVersion);

      await NocoCache.set(
        'root',
        `${CacheScope.MANAGED_APP_VERSION}:${managedAppVersionId}`,
        managedAppVersion,
      );
    }

    return new ManagedAppVersion(managedAppVersion);
  }

  public static async getByVersion(
    managedAppId: string,
    version: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedAppVersion> {
    const cacheKey = `${CacheScope.MANAGED_APP_VERSION}:${managedAppId}:${version}`;

    let managedAppVersion = await NocoCache.get(
      'root',
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );

    if (!managedAppVersion) {
      const versions = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.MANAGED_APP_VERSIONS,
        {
          xcCondition: {
            _and: [
              { fk_managed_app_id: { eq: managedAppId } },
              { version: { eq: version } },
            ],
          },
        },
      );

      if (!versions || versions.length === 0) return null;

      managedAppVersion = prepareForResponse(versions[0]);

      await NocoCache.set('root', cacheKey, managedAppVersion);
    }

    return new ManagedAppVersion(managedAppVersion);
  }

  public static async list(
    managedAppId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedAppVersion[]> {
    const versions = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APP_VERSIONS,
      {
        xcCondition: {
          _and: [{ fk_managed_app_id: { eq: managedAppId } }],
        },
        orderBy: {
          version_number: 'desc',
        },
      },
    );

    return (
      versions?.map((v) => new ManagedAppVersion(prepareForResponse(v))) || []
    );
  }

  public static async getLatest(
    managedAppId: string,
    status?: ManagedAppVersionStatus,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedAppVersion> {
    const versions = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APP_VERSIONS,
      {
        xcCondition: {
          _and: [
            {
              fk_managed_app_id: { eq: managedAppId },
              ...(status ? { status: { eq: status } } : {}),
            },
          ],
        },
        orderBy: {
          version_number: 'desc',
        },
        limit: 1,
      },
    );

    if (!versions || versions.length === 0) return null;

    return new ManagedAppVersion(prepareForResponse(versions[0]));
  }

  public static async getNextVersionNumber(
    managedAppId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const latest = await this.getLatest(managedAppId, undefined, ncMeta);
    return latest ? latest.version_number + 1 : 1;
  }

  public static async insert(
    managedAppVersion: Partial<ManagedAppVersion>,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedAppVersion> {
    const insertObj = extractProps(managedAppVersion, [
      'id',
      'fk_managed_app_id',
      'version',
      'status',
      'fk_workspace_id',
      'schema',
      'release_notes',
    ]);

    // Default to draft if not specified
    insertObj.status = insertObj.status || ManagedAppVersionStatus.DRAFT;

    insertObj.version_number = await this.getNextVersionNumber(
      insertObj.fk_managed_app_id,
      ncMeta,
    );

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APP_VERSIONS,
      prepareForDb(insertObj),
    );

    return await this.get(id, ncMeta);
  }

  public static async delete(
    managedAppVersionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APP_VERSIONS,
      managedAppVersionId,
    );

    await NocoCache.del(
      'root',
      `${CacheScope.MANAGED_APP_VERSION}:${managedAppVersionId}`,
    );
  }

  public static async update(
    managedAppVersionId: string,
    managedAppVersion: Partial<ManagedAppVersion>,
    ncMeta = Noco.ncMeta,
  ): Promise<ManagedAppVersion> {
    const updateObj = extractProps(managedAppVersion, [
      'version',
      'status',
      'schema',
      'release_notes',
      'published_at',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MANAGED_APP_VERSIONS,
      prepareForDb(updateObj),
      managedAppVersionId,
    );

    await NocoCache.del(
      'root',
      `${CacheScope.MANAGED_APP_VERSION}:${managedAppVersionId}`,
    );

    return this.get(managedAppVersionId, ncMeta);
  }

  public getParsedSchema(): any {
    try {
      return JSON.parse(this.schema);
    } catch (e) {
      console.error('Failed to parse managed app version schema:', e);
      return null;
    }
  }
}
