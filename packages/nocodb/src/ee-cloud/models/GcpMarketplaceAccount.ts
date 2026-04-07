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

export default class GcpMarketplaceAccount {
  id: string;
  procurement_account_id: string;
  fk_user_id?: string;
  state: string; // pending | active | deleted
  link_token?: string;
  link_token_expires_at?: string;
  meta?: Record<string, any>;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<GcpMarketplaceAccount>) {
    Object.assign(this, data);
  }

  public static async get(
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceAccount | null> {
    const cacheKey = `${CacheScope.GCP_MARKETPLACE_ACCOUNT}:${id}`;

    let record = await NocoCache.get(
      'root',
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );

    if (!record) {
      record = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.GCP_MARKETPLACE_ACCOUNTS,
        { id },
      );

      if (!record) return null;

      record = prepareForResponse(record, ['meta']);
      await NocoCache.set('root', cacheKey, record);

      await NocoCache.set(
        'root',
        `${CacheScope.GCP_MARKETPLACE_ACCOUNT_ALIAS}:proc:${record.procurement_account_id}`,
        cacheKey,
      );
    }

    return new GcpMarketplaceAccount(record);
  }

  public static async getByProcurementAccountId(
    procAccountId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceAccount | null> {
    const aliasKey = `${CacheScope.GCP_MARKETPLACE_ACCOUNT_ALIAS}:proc:${procAccountId}`;
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
        MetaTable.GCP_MARKETPLACE_ACCOUNTS,
        {},
        null,
        { procurement_account_id: { eq: procAccountId } },
      );

      if (!record) return null;

      record = prepareForResponse(record, ['meta']);

      const key = `${CacheScope.GCP_MARKETPLACE_ACCOUNT}:${record.id}`;
      await NocoCache.set('root', key, record);
      await NocoCache.set('root', aliasKey, key);
    }

    return new GcpMarketplaceAccount(record);
  }

  public static async getByLinkToken(
    linkToken: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceAccount | null> {
    const record = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ACCOUNTS,
      {},
      null,
      { link_token: { eq: linkToken } },
    );

    if (!record) return null;

    return new GcpMarketplaceAccount(prepareForResponse(record, ['meta']));
  }

  public static async getByUserId(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceAccount | null> {
    const record = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ACCOUNTS,
      {},
      null,
      { fk_user_id: { eq: userId } },
    );

    if (!record) return null;

    return new GcpMarketplaceAccount(prepareForResponse(record, ['meta']));
  }

  public static async insert(
    data: Partial<GcpMarketplaceAccount>,
    ncMeta = Noco.ncMeta,
  ): Promise<GcpMarketplaceAccount> {
    const insertObj: Record<string, any> = extractProps(data, [
      'procurement_account_id',
      'fk_user_id',
      'state',
      'link_token',
      'link_token_expires_at',
      'meta',
    ]);

    insertObj.state = insertObj.state || 'pending';

    if (!insertObj.procurement_account_id) {
      throw new Error('procurement_account_id is required');
    }

    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ACCOUNTS,
      prepareForDb(insertObj, ['meta']),
    );

    const inserted = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ACCOUNTS,
      {},
      null,
      { procurement_account_id: { eq: insertObj.procurement_account_id } },
    );

    return new GcpMarketplaceAccount(prepareForResponse(inserted, ['meta']));
  }

  public static async update(
    id: string,
    data: Partial<GcpMarketplaceAccount>,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const updateObj: Record<string, any> = extractProps(data, [
      'fk_user_id',
      'state',
      'link_token',
      'link_token_expires_at',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.GCP_MARKETPLACE_ACCOUNTS,
      prepareForDb(updateObj, ['meta']),
      id,
    );

    const cacheKey = `${CacheScope.GCP_MARKETPLACE_ACCOUNT}:${id}`;
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
      MetaTable.GCP_MARKETPLACE_ACCOUNTS,
      id,
    );

    await NocoCache.del('root', `${CacheScope.GCP_MARKETPLACE_ACCOUNT}:${id}`);
    await NocoCache.del(
      'root',
      `${CacheScope.GCP_MARKETPLACE_ACCOUNT_ALIAS}:proc:${record.procurement_account_id}`,
    );

    return true;
  }
}
