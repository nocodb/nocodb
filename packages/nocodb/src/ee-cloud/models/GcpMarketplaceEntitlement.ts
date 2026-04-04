import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class GcpMarketplaceEntitlement {
  id: string;
  entitlement_id: string;
  fk_gcp_account_id: string;
  fk_installation_id?: string;
  plan?: string;
  state: string; // pending | active | cancelled | deleted
  meta?: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<GcpMarketplaceEntitlement>) {
    Object.assign(this, data);
  }

  public static async get(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceEntitlement | null> {
    const cacheKey = `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT}:${id}`;

    let record = await NocoCache.get(
      'root',
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );

    if (!record) {
      record = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
        { id },
      );

      if (!record) return null;

      record = prepareForResponse(record, ['meta']);
      await NocoCache.set('root', cacheKey, record);

      await NocoCache.set(
        'root',
        `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT_ALIAS}:eid:${record.entitlement_id}`,
        cacheKey,
      );
    }

    return new GcpMarketplaceEntitlement(record);
  }

  public static async getByEntitlementId(
    entitlementId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceEntitlement | null> {
    const aliasKey = `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT_ALIAS}:eid:${entitlementId}`;
    const cacheKey = await NocoCache.get(
      'root',
      aliasKey,
      CacheGetType.TYPE_STRING,
    );

    let record = cacheKey
      ? await NocoCache.get('root', cacheKey, CacheGetType.TYPE_OBJECT)
      : null;

    if (!record) {
      record = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
        {},
        null,
        { entitlement_id: { eq: entitlementId } },
      );

      if (!record) return null;

      record = prepareForResponse(record, ['meta']);

      const key = `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT}:${record.id}`;
      await NocoCache.set('root', key, record);
      await NocoCache.set('root', aliasKey, key);
    }

    return new GcpMarketplaceEntitlement(record);
  }

  public static async listByAccountId(
    gcpAccountId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceEntitlement[]> {
    const records = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
      {
        condition: { fk_gcp_account_id: gcpAccountId },
        orderBy: { created_at: 'desc' },
      },
    );

    return records.map(
      (r) => new GcpMarketplaceEntitlement(prepareForResponse(r, ['meta'])),
    );
  }

  public static async getByInstallationId(
    installationId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceEntitlement | null> {
    const record = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
      {},
      null,
      { fk_installation_id: { eq: installationId } },
    );

    if (!record) return null;

    return new GcpMarketplaceEntitlement(prepareForResponse(record, ['meta']));
  }

  public static async insert(
    data: Partial<GcpMarketplaceEntitlement>,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceEntitlement> {
    const insertObj: Record<string, any> = extractProps(data, [
      'entitlement_id',
      'fk_gcp_account_id',
      'fk_installation_id',
      'plan',
      'state',
      'meta',
    ]);

    insertObj.state = insertObj.state || 'pending';

    if (!insertObj.entitlement_id) {
      throw new Error('entitlement_id is required');
    }
    if (!insertObj.fk_gcp_account_id) {
      throw new Error('fk_gcp_account_id is required');
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
      prepareForDb(insertObj, ['meta']),
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    id: string,
    data: Partial<GcpMarketplaceEntitlement>,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const updateObj: Record<string, any> = extractProps(data, [
      'fk_installation_id',
      'plan',
      'state',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
      prepareForDb(updateObj, ['meta']),
      id,
    );

    const cacheKey = `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT}:${id}`;
    await NocoCache.update(
      'root',
      cacheKey,
      prepareForResponse(updateObj, ['meta']),
    );

    return true;
  }

  public static async delete(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const record = await this.get(id, ncMeta);
    if (!record) return false;

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
      id,
    );

    await NocoCache.del(
      'root',
      `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT}:${id}`,
    );
    await NocoCache.del(
      'root',
      `${CacheScope.GCP_MARKETPLACE_ENTITLEMENT_ALIAS}:eid:${record.entitlement_id}`,
    );

    return true;
  }
}
