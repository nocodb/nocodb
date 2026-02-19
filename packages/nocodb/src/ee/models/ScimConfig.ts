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
  fk_workspace_id: string;
  enabled: boolean;
  provisioning_token: string; // encrypted
  base_url: string; // generated SCIM endpoint URL
  role_mapping?: Record<string, any>; // map IdP group names to NocoDB roles
  created_at?: Date;
  updated_at?: Date;
}

export default class ScimConfig implements ScimConfigType {
  id: string;
  fk_workspace_id: string;
  enabled: boolean;
  provisioning_token: string;
  base_url: string;
  role_mapping?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;

  constructor(config: Partial<ScimConfigType>) {
    Object.assign(this, config);
  }

  public static async get(
    context: NcContext,
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ScimConfig | null> {
    const key = `${CacheScope.SCIM_CONFIG}:${workspaceId}`;
    let config = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);

    if (!config) {
      config = await ncMeta.metaGet2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.SCIM_CONFIG,
        {
          fk_workspace_id: workspaceId,
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
      'fk_workspace_id',
      'enabled',
      'provisioning_token',
      'base_url',
      'role_mapping',
    ]);

    // prepareForDb handles stringification of role_mapping internally
    const { id } = await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.SCIM_CONFIG,
      prepareForDb(insertObj, 'role_mapping'),
    );

    const key = `${CacheScope.SCIM_CONFIG}:${config.fk_workspace_id}`;
    await NocoCache.del(context, key);

    return this.get(context, config.fk_workspace_id!, ncMeta);
  }

  public static async update(
    context: NcContext,
    workspaceId: string,
    config: Partial<ScimConfigType>,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const updateObj: Record<string, any> = extractProps(config, [
      'enabled',
      'provisioning_token',
      'base_url',
      'role_mapping',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.SCIM_CONFIG,
      prepareForDb(updateObj, 'role_mapping'),
      {
        fk_workspace_id: workspaceId,
      },
    );

    const key = `${CacheScope.SCIM_CONFIG}:${workspaceId}`;
    await NocoCache.update(
      context,
      key,
      prepareForResponse(updateObj, 'role_mapping'),
    );

    return true;
  }

  public static async delete(
    context: NcContext,
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.SCIM_CONFIG,
      {
        fk_workspace_id: workspaceId,
      },
    );

    const key = `${CacheScope.SCIM_CONFIG}:${workspaceId}`;
    await NocoCache.del(context, key);

    return true;
  }
}
