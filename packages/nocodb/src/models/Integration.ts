import CryptoJS from 'crypto-js';
import type { IntegrationsType } from 'nocodb-sdk';
import type { BoolType, IntegrationType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Condition } from '~/db/CustomKnex';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import {
  parseMetaProp,
  prepareForDb,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { partialExtract } from '~/utils';

// todo: hide credentials
export default class Integration implements IntegrationType {
  id?: string;
  fk_workspace_id?: string;
  title?: string;
  type?: IntegrationsType;
  sub_type?: IntegrationsType;
  config?: string;
  order?: number;
  enabled?: BoolType;
  is_private?: BoolType;
  meta?: any;
  created_by?: string;

  constructor(integration: Partial<IntegrationType>) {
    Object.assign(this, integration);
  }

  protected static castType(integration: Integration): Integration {
    return integration && new Integration(integration);
  }

  public static async createIntegration(
    integration: IntegrationType & {
      workspaceId: string;
      created_at?;
      updated_at?;
      meta?: any;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(integration, [
      'title',
      'config',
      'type',
      'sub_type',
      'enabled',
      'meta',
      'created_by',
    ]);

    insertObj.config = CryptoJS.AES.encrypt(
      JSON.stringify(insertObj.config),
      Noco.getConfig()?.auth?.jwt?.secret,
    ).toString();

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.INTEGRATIONS, {
      fk_workspace_id: integration.workspaceId,
    });

    insertObj.fk_workspace_id = integration.workspaceId;

    const { id } = await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      insertObj,
    );

    return await this.get(id, false, ncMeta);
  }

  public static async updateIntegration(
    context: NcContext,
    integrationId: string,
    integration: IntegrationType & {
      meta?: any;
      deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const oldIntegration = await Integration.get(integrationId, false, ncMeta);

    if (!oldIntegration) NcError.integrationNotFound(integrationId);

    const updateObj = extractProps(integration, [
      'title',
      'type',
      'sub_type',
      'order',
      'enabled',
      'meta',
      'deleted',
      'config',
    ]);

    if (updateObj.config) {
      updateObj.config = CryptoJS.AES.encrypt(
        JSON.stringify(integration.config),
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString();
    }

    // type property is undefined even if not provided
    if (!updateObj.type) {
      updateObj.type = oldIntegration.type;
    }

    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // if order is missing (possible in old versions), get next order
    if (!oldIntegration.order && !updateObj.order) {
      if (updateObj.order <= 1) {
        updateObj.order = 2;
      }
    }

    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      prepareForDb(updateObj),
      oldIntegration.id,
    );

    // await NocoCache.update(
    //   `${CacheScope.BASE}:${integrationId}`,
    //   prepareForResponse(updateObj),
    // );

    // call before reorder to update cache
    const returnBase = await this.get(oldIntegration.id, false, ncMeta);

    return returnBase;
  }

  static async list(
    args: {
      workspaceId: string;
      haveWorkspaceLevelPermission: boolean;
      userId: string;
      includeDatabaseInfo?: boolean;
      type?: IntegrationsType;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Integration[]> {
    // const cachedList = await NocoCache.getList(CacheScope.BASE, [args.workspaceId]);
    // let { list: integrationList } = cachedList;
    // const { isNoneList } = cachedList;
    // if (!isNoneList && !integrationList.length)

    const conditions: Condition[] = [];

    // if user have workspace level permission(creator, owner) then show all integrations which are not deleted
    // and exclude integrations which are private and not created by user
    if (args.haveWorkspaceLevelPermission) {
      conditions.push({
        _or: [
          {
            is_private: {
              eq: false,
            },
          },
          {
            created_by: {
              eq: args.userId,
            },
          },
        ],
      });
    }

    // if type is provided then filter integrations based on type
    if (args.type) {
      conditions.push({
        type: {
          eq: args.type,
        },
      });
    }

    // if user don't have workspace level permission then show only integrations which are owned by user
    else {
      conditions.push({
        created_by: {
          eq: args.userId,
        },
      });
    }

    const integrationList = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        xcCondition: {
          _and: [
            {
              _or: [
                {
                  deleted: {
                    neq: true,
                  },
                },
                {
                  deleted: {
                    eq: null,
                  },
                },
              ],
            },
            ...conditions,
          ],
        },
        orderBy: {
          order: 'asc',
        },
      },
    );

    // parse JSON metadata
    for (const integration of integrationList) {
      integration.meta = parseMetaProp(integration, 'meta');
    }

    // await NocoCache.setList(CacheScope.BASE, [args.baseId], integrationList);
    // }

    // integrationList.sort(
    //   (a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity),
    // );

    const integrations = integrationList?.map((baseData) => {
      return this.castType(baseData);
    });

    // if includeDatabaseInfo is true then get the database info for each integration
    if (args.includeDatabaseInfo) {
      for (const integration of integrations) {
        const config = integration.getConfig();
        integration.config = partialExtract(config, [
          'client',
          ['connection', 'database'],
          ['searchPath'],
        ]);
      }
    }

    return integrations;
  }

  static async get(
    id: string,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Integration> {
    // let baseData =
    //   id &&
    //   (await NocoCache.get(
    //     `${CacheScope.BASE}:${id}`,
    //     CacheGetType.TYPE_OBJECT,
    //   ));
    // if (!baseData) {
    const baseData = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      id,
      null,
      force
        ? {}
        : {
            _or: [
              {
                deleted: {
                  neq: true,
                },
              },
              {
                deleted: {
                  eq: null,
                },
              },
            ],
          },
    );

    if (baseData) {
      baseData.meta = parseMetaProp(baseData, 'meta');
    }

    // await NocoCache.set(`${CacheScope.BASE}:${id}`, baseData);
    return this.castType(baseData);
  }

  static async getByUUID(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ) {
    const integration = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.INTEGRATIONS,
      {
        erd_uuid: uuid,
      },
      null,
      {
        _or: [
          {
            deleted: {
              neq: true,
            },
          },
          {
            deleted: {
              eq: null,
            },
          },
        ],
      },
    );

    if (!integration) return null;

    delete integration.config;

    return this.castType(integration);
  }

  public async getConnectionConfig(): Promise<any> {
    const config = this.getConfig();

    // todo: update sql-client args
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

    return config;
  }

  public getConfig(): any {
    const config = JSON.parse(
      CryptoJS.AES.decrypt(
        this.config,
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString(CryptoJS.enc.Utf8),
    );

    return config;
  }

  async delete(ncMeta = Noco.ncMeta) {
    const res = await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      this.id,
    );

    await NocoCache.deepDel(
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  async softDelete(ncMeta = Noco.ncMeta) {
    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        deleted: true,
      },
      this.id,
    );

    // await NocoCache.deepDel(
    //   `${CacheScope.BASE}:${this.id}`,
    //   CacheDelDirection.CHILD_TO_PARENT,
    // );
  }
}