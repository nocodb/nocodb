import type {
  OpenIDClientConfigType,
  SAMLClientConfigType,
  SSOClientType,
} from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

export default class SSOClient implements SSOClientType {
  config: SAMLClientConfigType | OpenIDClientConfigType;
  id: string;
  title: string;
  type: 'saml' | 'oidc';
  enabled: boolean;
  deleted?: boolean;
  fk_user_id: string;
  fk_workspace_id: string;

  constructor(client: Partial<SSOClientType>) {
    Object.assign(this, client);
  }

  public static async get(clientId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.SSO_CLIENT}:${clientId}`;
    let client = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!client) {
      client = await ncMeta.metaGet2(null, null, MetaTable.SSO_CLIENT, {
        id: clientId,
      });

      if (!client) return null;

      client.config = parseMetaProp(client, 'config');
      await NocoCache.set(key, client);
    }

    return new SSOClient(client);
  }

  public static async insert(client: Partial<SSOClient>, ncMeta = Noco.ncMeta) {
    const insertObj: Record<string, any> = extractProps(client, [
      'title',
      'type',
      'config',
      'enabled',
      'fk_user_id',
      'fk_workspace_id',
      'deleted',
    ]);

    if ('config' in insertObj) {
      insertObj.config = stringifyMetaProp(insertObj, 'config');
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.SSO_CLIENT,
      client,
    );
    return this.get(id, ncMeta);
  }

  public static async update(
    clientId: string,
    client: Partial<SSOClientType & { deleted?: boolean }>,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.SSO_CLIENT}:${clientId}`;
    const updateObj: Record<string, any> = extractProps(client, [
      'title',
      'type',
      'config',
      'enabled',
      'deleted',
    ]);

    const cacheObj = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (cacheObj) {
      Object.assign(cacheObj, updateObj);
      await NocoCache.set(key, cacheObj);
    }
    if ('config' in updateObj) {
      updateObj.config = stringifyMetaProp(updateObj, 'config');
    }

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.SSO_CLIENT,
      updateObj,
      clientId,
    );

    return true;
  }

  public static async delete(clientId: string, ncMeta = Noco.ncMeta) {
    // delete from cache
    await ncMeta.metaDelete(null, null, MetaTable.SSO_CLIENT, clientId);

    const key = `${CacheScope.SSO_CLIENT}:${clientId}`;
    await NocoCache.del(key);

    return true;
  }

  static async list(param: any) {
    const clients = await Noco.ncMeta.metaList2(
      null,
      null,
      MetaTable.SSO_CLIENT,
      param.type ? { condition: { type: param.type } } : null,
    );

    return clients.map((client) => {
      client.config = parseMetaProp(client, 'config');
      return new SSOClient(client);
    });
  }
}
