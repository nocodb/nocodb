import type {
  GoogleClientConfigType,
  OpenIDClientConfigType,
  SAMLClientConfigType,
  SSOClientType,
} from 'nocodb-sdk';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import { isCloud } from '~/utils';
import { ApiToken } from '~/models';

const PUBLIC_LIST_KEY = `${CacheScope.SSO_CLIENT_PUBLIC_LIST}:default`;

export default class SSOClient implements SSOClientType {
  config:
    | SAMLClientConfigType
    | OpenIDClientConfigType
    | GoogleClientConfigType;
  id: string;
  title: string;
  type: 'saml' | 'oidc' | 'google';
  enabled: boolean;
  deleted?: boolean;
  fk_user_id: string;
  fk_org_id?: string;
  fk_workspace_id?: string;

  constructor(client: Partial<SSOClientType>) {
    Object.assign(this, client);
  }

  public static async get(clientId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.SSO_CLIENT}:${clientId}`;
    let client = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!client) {
      client = await ncMeta.metaGet2(
        RootScopes.ORG,
        RootScopes.ORG,
        MetaTable.SSO_CLIENT,
        clientId,
      );

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
      'fk_org_id',
      'deleted',
    ]);

    if ('config' in insertObj) {
      insertObj.config = stringifyMetaProp(insertObj, 'config');
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.SSO_CLIENT,
      client,
    );
    await NocoCache.del(PUBLIC_LIST_KEY);
    return this.get(id, ncMeta);
  }

  public static async update(
    clientId: string,
    client: Partial<SSOClientType & { deleted?: boolean }>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(client, [
      'title',
      'type',
      'config',
      'enabled',
      'deleted',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.SSO_CLIENT,
      prepareForDb(updateObj, 'config'),
      clientId,
    );

    await NocoCache.update(
      `${CacheScope.SSO_CLIENT}:${clientId}`,
      prepareForResponse(updateObj, 'config'),
    );
    await NocoCache.del(PUBLIC_LIST_KEY);

    return true;
  }

  public static async delete(clientId: string, ncMeta = Noco.ncMeta) {
    // First, clear SSO association from API tokens linked to this SSO client
    await ApiToken.clearSsoAssociation(clientId, ncMeta);

    // delete SSO client from cache
    await ncMeta.metaDelete(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.SSO_CLIENT,
      clientId,
    );

    const key = `${CacheScope.SSO_CLIENT}:${clientId}`;
    await NocoCache.del(key);
    await NocoCache.del(PUBLIC_LIST_KEY);

    return true;
  }

  static async list(param: {
    type?: 'saml' | 'oidc' | 'google';
    orgId?: string;
    workspaceId?: string;
  }) {
    const condition = {};

    if (param.type) {
      condition['type'] = param.type;
    }

    if (param.orgId) {
      condition['fk_org_id'] = param.orgId;
    }

    if (param.workspaceId) {
      condition['fk_workspace_id'] = param.workspaceId;
    }

    const clients = await Noco.ncMeta.metaList2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.SSO_CLIENT,
      {
        condition,
      },
    );

    return clients.map((client) => {
      client.config = parseMetaProp(client, 'config');
      return new SSOClient(client);
    });
  }

  static async getPublicList(param: { ncSiteUrl: string }) {
    if (isCloud) {
      return [];
    }

    const cacheData: { list: any[] } = await NocoCache.get(
      PUBLIC_LIST_KEY,
      CacheGetType.TYPE_OBJECT,
    );
    if (cacheData?.list) return cacheData?.list;

    const list = await this.list({});

    const filteredList = list
      .filter(
        (client) =>
          client.enabled &&
          !client.deleted &&
          !client.fk_org_id &&
          !client.fk_workspace_id,
      )
      .map((client) => {
        return {
          id: client.id,
          url: new URL(`/sso/${client.id}`, param.ncSiteUrl).toString(),
          title: client.title,
          type: client.type,
        };
      });

    await NocoCache.set(PUBLIC_LIST_KEY, { list: filteredList });

    return filteredList;
  }

  static async listByOrgId(fk_org_id: string, siteUrl: string) {
    if (!fk_org_id) {
      return [];
    }

    const clients = await Noco.ncMeta.metaList2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.SSO_CLIENT,
      {
        condition: {
          fk_org_id,
          deleted: false,
        },
      },
    );

    const list = clients.map((client) => {
      client.config = parseMetaProp(client, 'config');
      return new SSOClient(client);
    });

    const filteredList = list
      .filter((client) => client.enabled && !client.deleted)
      .map((client) => {
        return {
          id: client.id,
          url: new URL(`/sso/${client.id}`, siteUrl).toString(),
          title: client.title,
          type: client.type,
        };
      });

    return filteredList;
  }

  static async listByWorkspaceId(fk_workspace_id: string, siteUrl: string) {
    if (!fk_workspace_id) {
      return [];
    }

    const clients = await Noco.ncMeta.metaList2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.SSO_CLIENT,
      {
        condition: {
          fk_workspace_id,
          deleted: false,
        },
      },
    );

    const list = clients.map((client) => {
      client.config = parseMetaProp(client, 'config');
      return new SSOClient(client);
    });

    const filteredList = list
      .filter((client) => client.enabled && !client.deleted)
      .map((client) => {
        return {
          id: client.id,
          url: new URL(`/sso/${client.id}`, siteUrl).toString(),
          title: client.title,
          type: client.type,
        };
      });

    return filteredList;
  }
}
