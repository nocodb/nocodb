import type { NcContext } from '~/interface/config';
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

export interface ScimConfigType {
  id: string;
  fk_org_id: string;
  enabled: boolean;
  provisioning_token: string; // encrypted
  role_mapping?: Record<string, any>; // map IdP group names to NocoDB roles
  default_role?: string; // default workspace role for SCIM-provisioned users
  created_at?: Date;
  updated_at?: Date;
}

export default class ScimConfig implements ScimConfigType {
  id: string;
  fk_org_id: string;
  enabled: boolean;
  provisioning_token: string;
  role_mapping?: Record<string, any>;
  default_role?: string;
  created_at?: Date;
  updated_at?: Date;

  constructor(config: Partial<ScimConfigType>) {
    Object.assign(this, config);
  }

  public static async get(
    context: NcContext,
    orgId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ScimConfig | null> {
    const key = `${CacheScope.SCIM_CONFIG}:${orgId}`;
    let config = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);

    if (!config) {
      config = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SCIM_CONFIG,
        {
          fk_org_id: orgId,
        },
      );

      if (!config) return null;

      config.role_mapping = parseMetaProp(config, 'role_mapping');
      await NocoCache.set(context, key, config);
    }

    return new ScimConfig(prepareForResponse(config, 'role_mapping'));
  }

  public static async insert(
    context: NcContext,
    config: Partial<ScimConfig>,
    ncMeta = Noco.ncMeta,
  ): Promise<ScimConfig> {
    const insertObj: Record<string, any> = extractProps(config, [
      'fk_org_id',
      'enabled',
      'provisioning_token',
      'role_mapping',
      'default_role',
    ]);

    // prepareForDb handles stringification of role_mapping internally
    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SCIM_CONFIG,
      prepareForDb(insertObj, 'role_mapping'),
    );

    const key = `${CacheScope.SCIM_CONFIG}:${config.fk_org_id}`;
    await NocoCache.del(context, key);

    return this.get(context, config.fk_org_id!, ncMeta);
  }

  public static async update(
    context: NcContext,
    orgId: string,
    config: Partial<ScimConfigType>,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const updateObj: Record<string, any> = extractProps(config, [
      'enabled',
      'provisioning_token',
      'role_mapping',
      'default_role',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SCIM_CONFIG,
      prepareForDb(updateObj, 'role_mapping'),
      {
        fk_org_id: orgId,
      },
    );

    const key = `${CacheScope.SCIM_CONFIG}:${orgId}`;
    await NocoCache.update(
      context,
      key,
      prepareForResponse(updateObj, 'role_mapping'),
    );

    return true;
  }

  public static async delete(
    context: NcContext,
    orgId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SCIM_CONFIG,
      {
        fk_org_id: orgId,
      },
    );

    const key = `${CacheScope.SCIM_CONFIG}:${orgId}`;
    await NocoCache.del(context, key);

    return true;
  }
}
