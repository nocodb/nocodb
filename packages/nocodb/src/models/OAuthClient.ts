import { nanoid } from 'nanoid';
import { OAuthClientType, OAuthTokenEndpointAuthMethod } from 'nocodb-sdk';
import type { OAuthClient as IOAuthClient } from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

export default class OAuthClient implements IOAuthClient {
  client_id: string;
  client_secret?: string | null;
  client_type: OAuthClientType;
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris: string[];
  allowed_grant_types: string[];
  response_types: string[];
  allowed_scopes: string;
  token_endpoint_auth_method: OAuthTokenEndpointAuthMethod;
  registration_access_token?: string;
  registration_client_uri?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  fk_user_id?: string;
  created_at: string;
  updated_at: string;

  constructor(client: Partial<IOAuthClient | OAuthClient>) {
    Object.assign(this, client);
  }

  public static async insert(
    clientData: Partial<OAuthClient>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertData = extractProps(clientData, [
      'client_type',
      'client_name',
      'client_uri',
      'logo_uri',
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
      'allowed_scopes',
      'token_endpoint_auth_method',
      'registration_client_uri',
      'registration_access_token',
      'client_id_issued_at',
      'client_secret_expires_at',
      'fk_user_id',
    ]);

    if (
      ![
        OAuthTokenEndpointAuthMethod.CLIENT_SECRET_BASIC,
        OAuthTokenEndpointAuthMethod.CLIENT_SECRET_POST,
      ].includes(insertData.token_endpoint_auth_method)
    ) {
      insertData.token_endpoint_auth_method =
        OAuthTokenEndpointAuthMethod.CLIENT_SECRET_BASIC;
    }

    insertData.client_id = nanoid(32);
    insertData.client_secret =
      clientData.client_type === OAuthClientType.CONFIDENTIAL
        ? nanoid(64)
        : null;

    insertData.client_id_issued_at = Date.now();

    insertData = prepareForDb(insertData, [
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
    ]);

    const res = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      insertData,
      true,
    );

    return this.getByClientId(res.client_id, ncMeta).then(async (client) => {
      await NocoCache.appendToList(
        CacheScope.OAUTH_CLIENT,
        [],
        `${CacheScope.OAUTH_CLIENT}:${res.client_id}`,
      );
      return client;
    });
  }

  static async getByClientId(clientId: string, ncMeta = Noco.ncMeta) {
    let data = await NocoCache.get(
      `${CacheScope.OAUTH_CLIENT}:${clientId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.OAUTH_CLIENTS,
        { client_id: clientId },
      );
      if (data) {
        await NocoCache.set(`${CacheScope.OAUTH_CLIENT}:${clientId}`, data);
      }
    }

    return data && this.castType(data);
  }

  static async list(userId?: string, ncMeta = Noco.ncMeta) {
    const condition = userId ? { fk_user_id: userId } : {};
    const clients = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      { condition },
    );
    return clients?.map((c) => this.castType(c));
  }

  static async delete(clientId: string, ncMeta = Noco.ncMeta) {
    if (!clientId) {
      return false;
    }

    await NocoCache.deepDel(
      `${CacheScope.OAUTH_CLIENT}:${clientId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      { client_id: clientId },
    );
  }

  static async update(
    clientId: string,
    body: Partial<OAuthClient>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!clientId) {
      return false;
    }

    let updateObj = extractProps(body, [
      'client_name',
      'client_uri',
      'logo_uri',
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
      'allowed_scopes',
      'token_endpoint_auth_method',
      'registration_client_uri',
      'client_secret_expires_at',
    ]);

    updateObj = prepareForDb(updateObj, [
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_CLIENTS,
      updateObj,
      { client_id: clientId },
    );

    await NocoCache.update(`${CacheScope.API_TOKEN}:${clientId}`, updateObj);

    return this.getByClientId(clientId, ncMeta);
  }

  public static castType(client: any): OAuthClient {
    if (!client) return null;

    client = prepareForResponse(client, [
      'redirect_uris',
      'allowed_grant_types',
      'response_types',
    ]);

    return new OAuthClient(client);
  }
}
