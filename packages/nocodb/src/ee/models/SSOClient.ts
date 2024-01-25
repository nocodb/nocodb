import type {
  OpenIDClientConfigType,
  SAMLClientConfigType,
  SSOClientType,
} from 'nocodb-sdk';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';

export default class SSOClient implements SSOClientType {
  config: SAMLClientConfigType | OpenIDClientConfigType | string;
  id: string;
  title: string;
  type: 'saml' | 'oidc';
  enabled: boolean;
  fk_user_id: string;
  fk_workspace_id: string;

  constructor(client: Partial<SSOClientType>) {
    Object.assign(this, client);
  }

  public static async get(clientId: string, ncMeta = Noco.ncMeta) {
    // todo: cache
    const client = await ncMeta.metaGet2(null, null, MetaTable.SSO_CLIENT, {
      id: clientId,
    });

    if (!client) return null;

    client.config = parseMetaProp(client, 'config');

    return new SSOClient(client);
  }

  public static async insert(client: SSOClientType, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(client, [
      'title',
      'type',
      'config',
      'enabled',
      'fk_user_id',
      'fk_workspace_id',
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
    id: string,
    client: SSOClientType,
    ncMeta = Noco.ncMeta,
  ) {
    // todo: update cache
    const updateObj = extractProps(client, [
      'title',
      'type',
      'config',
      'enabled',
    ]);

    if ('config' in updateObj) {
      updateObj.config = stringifyMetaProp(updateObj, 'config');
    }

    await ncMeta.metaUpdate(null, null, MetaTable.SSO_CLIENT, id, updateObj);
    return this.get(id, ncMeta);
  }

  public static async delete(id: string, ncMeta = Noco.ncMeta) {
    // delete from cache
    await ncMeta.metaDelete(null, null, MetaTable.SSO_CLIENT, id);
    return true;
  }

  static async list(param: {}) {
    const clients = await Noco.ncMeta.metaList2(
      null,
      null,
      MetaTable.SSO_CLIENT,
      param,
    );

    return clients.map((client) => {
      client.config = parseMetaProp(client, 'config');
      return new SSOClient(client);
    });
  }
}
