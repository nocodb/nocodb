import type { NcContext } from '~/interface/config';
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

export default class SandboxVersion {
  id?: string;
  fk_sandbox_id: string;
  version: string;
  version_number: number;
  fk_workspace_id: string;
  schema: string; // Serialized schema JSON
  release_notes?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<SandboxVersion>) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    sandboxVersionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxVersion> {
    let sandboxVersion =
      sandboxVersionId &&
      (await NocoCache.get(
        context,
        `${CacheScope.SANDBOX_VERSION}:${sandboxVersionId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!sandboxVersion) {
      sandboxVersion = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SANDBOX_VERSIONS,
        sandboxVersionId,
      );

      if (!sandboxVersion) return null;

      sandboxVersion = prepareForResponse(sandboxVersion);

      await NocoCache.set(
        context,
        `${CacheScope.SANDBOX_VERSION}:${sandboxVersionId}`,
        sandboxVersion,
      );
    }

    return new SandboxVersion(sandboxVersion);
  }

  public static async getByVersion(
    context: NcContext,
    sandboxId: string,
    version: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxVersion> {
    const cacheKey = `${CacheScope.SANDBOX_VERSION}:${sandboxId}:${version}`;

    let sandboxVersion = await NocoCache.get(
      context,
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );

    if (!sandboxVersion) {
      const versions = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SANDBOX_VERSIONS,
        {
          xcCondition: {
            _and: [
              { fk_sandbox_id: { eq: sandboxId } },
              { version: { eq: version } },
              { fk_workspace_id: { eq: context.workspace_id } },
            ],
          },
        },
      );

      if (!versions || versions.length === 0) return null;

      sandboxVersion = prepareForResponse(versions[0]);

      await NocoCache.set(context, cacheKey, sandboxVersion);
    }

    return new SandboxVersion(sandboxVersion);
  }

  public static async list(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxVersion[]> {
    const versions = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_VERSIONS,
      {
        xcCondition: {
          _and: [
            { fk_sandbox_id: { eq: sandboxId } },
            { fk_workspace_id: { eq: context.workspace_id } },
          ],
        },
        orderBy: {
          version_number: 'desc',
        },
      },
    );

    return (
      versions?.map((v) => new SandboxVersion(prepareForResponse(v))) || []
    );
  }

  public static async getLatest(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxVersion> {
    const versions = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_VERSIONS,
      {
        xcCondition: {
          _and: [
            { fk_sandbox_id: { eq: sandboxId } },
            { fk_workspace_id: { eq: context.workspace_id } },
          ],
        },
        orderBy: {
          version_number: 'desc',
        },
        limit: 1,
      },
    );

    if (!versions || versions.length === 0) return null;

    return new SandboxVersion(prepareForResponse(versions[0]));
  }

  public static async getNextVersionNumber(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const latest = await this.getLatest(context, sandboxId, ncMeta);
    return latest ? latest.version_number + 1 : 1;
  }

  public static async insert(
    context: NcContext,
    sandboxVersion: Partial<SandboxVersion>,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxVersion> {
    const insertObj = extractProps(sandboxVersion, [
      'id',
      'fk_sandbox_id',
      'version',
      'fk_workspace_id',
      'schema',
      'release_notes',
    ]);

    insertObj.version_number = await this.getNextVersionNumber(
      context,
      insertObj.fk_sandbox_id,
      ncMeta,
    );

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_VERSIONS,
      prepareForDb(insertObj),
    );

    return await this.get(context, id, ncMeta);
  }

  public static async delete(
    context: NcContext,
    sandboxVersionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_VERSIONS,
      sandboxVersionId,
    );

    await NocoCache.del(
      context,
      `${CacheScope.SANDBOX_VERSION}:${sandboxVersionId}`,
    );
  }

  public getParsedSchema(): any {
    try {
      return JSON.parse(this.schema);
    } catch (e) {
      console.error('Failed to parse sandbox version schema:', e);
      return null;
    }
  }
}
