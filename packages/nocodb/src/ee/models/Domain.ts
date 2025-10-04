import type { DomainType } from 'nocodb-sdk';
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
} from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

export default class Domain {
  id: string;
  fk_org_id: string;
  fk_workspace_id: string;
  fk_user_id: string;
  domain: string;
  verified: boolean;
  deleted: boolean;
  txt_value: string;
  last_verified: Date | string;

  constructor(domain: Partial<Domain>) {
    Object.assign(this, domain);
  }

  public static async get(domainId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.ORG_DOMAIN}:${domainId}`;
    let domain = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);
    if (!domain) {
      domain = await ncMeta.metaGet2(
        RootScopes.ORG,
        RootScopes.ORG,
        MetaTable.ORG_DOMAIN,
        {
          id: domainId,
        },
      );

      if (!domain) return null;

      domain.config = parseMetaProp(domain, 'config');
      await NocoCache.set('root', key, domain);
    }

    return new Domain(domain);
  }

  public static async insert(domain: Partial<Domain>, ncMeta = Noco.ncMeta) {
    const insertObj: Record<string, any> = extractProps(domain, [
      'fk_org_id',
      'fk_workspace_id',
      'fk_user_id',
      'domain',
      'verified',
      'deleted',
      'txt_value',
      'last_verified',
    ]);

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_DOMAIN,
      insertObj,
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    domainId: string,
    domain: Partial<DomainType & { deleted?: boolean }>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(domain, [
      // 'fk_org_id',
      // 'fk_workspace_id',
      'fk_user_id',
      'domain',
      'verified',
      'deleted',
      'txt_value',
      'last_verified',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_DOMAIN,
      prepareForDb(updateObj, 'config'),
      domainId,
    );

    await NocoCache.update(
      'root',
      `${CacheScope.ORG_DOMAIN}:${domainId}`,
      prepareForResponse(updateObj, 'config'),
    );

    return true;
  }

  public static async delete(domainId: string, ncMeta = Noco.ncMeta) {
    // delete from cache
    await ncMeta.metaDelete(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_DOMAIN,
      domainId,
    );

    const key = `${CacheScope.ORG_DOMAIN}:${domainId}`;
    await NocoCache.del('root', key);

    return true;
  }

  static async list(
    param: { orgId?: string; workspaceId?: string },
    ncMeta = Noco.ncMeta,
  ) {
    if (!param.orgId && !param.workspaceId) {
      return [];
    }

    const domains = await ncMeta.metaList2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_DOMAIN,
      {
        condition: param.orgId
          ? { fk_org_id: param.orgId }
          : {
              fk_workspace_id: param.workspaceId,
            },
      },
    );

    return domains.map((domain) => {
      domain.config = parseMetaProp(domain, 'config');
      return new Domain(domain);
    });
  }

  // todo: cache this
  static async getByDomain(domain: string, ncMeta = Noco.ncMeta) {
    const domainObj = await ncMeta.metaGet2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_DOMAIN,
      {
        domain,
        verified: true,
      },
    );

    if (!domainObj) return null;

    domainObj.config = parseMetaProp(domainObj, 'config');
    return new Domain(domainObj);
  }

  static async deleteDuplicateDomain(
    domain: string,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_DOMAIN,
      {
        domain,
      },
      {
        id: {
          neq: id,
        },
      },
    );
  }
}
