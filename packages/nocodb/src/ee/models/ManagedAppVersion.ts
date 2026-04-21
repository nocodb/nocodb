import { gunzipSync, gzipSync } from 'zlib';
import { ManagedAppVersionStatus } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
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

const logger = new Logger('ManagedAppVersion');

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

    // Compress schema before storage
    if (insertObj.schema) {
      insertObj.schema = ManagedAppVersion.compressSchema(insertObj.schema);
    }

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

    // Compress schema before storage
    if (updateObj.schema) {
      updateObj.schema = ManagedAppVersion.compressSchema(updateObj.schema);
    }

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

  /**
   * Batch-fetch versions by IDs. Used to eliminate N+1 in Base.list().
   * Results are cached individually.
   */
  public static async getByIds(
    ids: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, ManagedAppVersion>> {
    const result = new Map<string, ManagedAppVersion>();
    if (!ids.length) return result;

    // Check cache in parallel
    const cacheResults = await Promise.all(
      ids.map((id) =>
        NocoCache.get(
          'root',
          `${CacheScope.MANAGED_APP_VERSION}:${id}`,
          CacheGetType.TYPE_OBJECT,
        ).then((cached) => ({ id, cached })),
      ),
    );

    const uncachedIds: string[] = [];
    for (const { id, cached } of cacheResults) {
      if (cached) {
        result.set(id, new ManagedAppVersion(cached));
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length) {
      const rows = await ncMeta
        .knexConnection(MetaTable.MANAGED_APP_VERSIONS)
        .whereIn('id', uncachedIds);

      for (const row of rows || []) {
        const data = prepareForResponse(row);
        await NocoCache.set(
          'root',
          `${CacheScope.MANAGED_APP_VERSION}:${data.id}`,
          data,
        );
        result.set(data.id, new ManagedAppVersion(data));
      }
    }

    return result;
  }

  /**
   * Compress a JSON string with gzip + base64 for TEXT column storage.
   * Prefixed with 'gz:' so we can distinguish from legacy uncompressed data.
   */
  private static compressSchema(json: string): string {
    if (!json) return json;
    const compressed = gzipSync(Buffer.from(json, 'utf-8'));
    return 'gz:' + compressed.toString('base64');
  }

  /**
   * Decompress schema. Handles both gzipped ('gz:' prefix) and legacy plain JSON.
   */
  private static decompressSchema(stored: string): string {
    if (!stored) return stored;
    if (stored.startsWith('gz:')) {
      const buf = Buffer.from(stored.slice(3), 'base64');
      return gunzipSync(buf).toString('utf-8');
    }
    // Legacy uncompressed — return as-is
    return stored;
  }

  public getParsedSchema(): any {
    try {
      const raw = ManagedAppVersion.decompressSchema(this.schema);
      return JSON.parse(raw);
    } catch (e) {
      logger.error('Failed to parse managed app version schema', e.stack);
      return null;
    }
  }
}
