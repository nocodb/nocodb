import { Integration as IntegrationCE } from 'src/models';
import { integrationCategoryNeedDefault } from 'nocodb-sdk';
import type {
  BoolType,
  IntegrationsType,
  IntegrationType,
  SourceType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
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
import { decryptPropIfRequired, partialExtract } from '~/utils';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { User } from '~/models';
import NocoCache from '~/cache/NocoCache';

export default class Integration extends IntegrationCE {
  id?: string;
  fk_workspace_id?: string;
  title?: string;
  type?: IntegrationsType;
  sub_type?: IntegrationsType;
  config?: string;
  order?: number;
  enabled?: BoolType;
  is_private?: BoolType;
  is_default?: BoolType;
  is_global?: BoolType;
  meta?: any;
  created_by?: string;
  sources?: Partial<SourceType>[];

  constructor(integration: Partial<IntegrationType>) {
    super(integration);
  }

  protected static castType(integration: Integration): Integration {
    return integration && new Integration(integration);
  }

  public static async init() {
    // we use dynamic import to avoid circular reference
    const ceIntegrations = (await import('src/integrations/integrations'))
      .default;

    const eeIntegrations = (await import('src/ee/integrations/integrations'))
      .default;

    // we use dynamic import to avoid circular reference
    Integration.availableIntegrations = [...ceIntegrations, ...eeIntegrations];
    IntegrationCE.availableIntegrations = Integration.availableIntegrations;
  }

  public static async createIntegration(
    integration: IntegrationType & {
      workspaceId: string;
      created_at?;
      updated_at?;
      meta?: any;
      is_encrypted?: boolean;
      is_default?: boolean;
      is_global?: boolean;
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
      'is_private',
      'is_encrypted',
      'is_global',
    ]);

    this.encryptConfigIfRequired(insertObj);

    if (insertObj.is_global) {
      const user = await User.get(insertObj.created_by, ncMeta);

      if (!user.email.match(/@nocodb.com$/)) {
        NcError.badRequest('Only admin can create global integrations');
      }

      // delete global integration cache for the type
      await NocoCache.deepDel(
        `${CacheScope.INTEGRATION_GLOBAL}:${insertObj.type}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    insertObj.fk_workspace_id =
      insertObj.fk_workspace_id || integration.workspaceId;

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.INTEGRATIONS, {
      fk_workspace_id: insertObj.fk_workspace_id,
    });

    if (integrationCategoryNeedDefault(insertObj.type)) {
      // get if default integration exists for the type
      const defaultIntegration = await this.getCategoryDefault(
        {
          workspace_id: insertObj.fk_workspace_id,
        },
        insertObj.type,
        ncMeta,
      );

      // if default integration already exists then set is_default to false
      if (defaultIntegration && !defaultIntegration.is_global) {
        insertObj.is_default = false;
      } else {
        insertObj.is_default = true;
      }
    }

    const { id } = await ncMeta.metaInsert2(
      insertObj.fk_workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      insertObj,
    );

    return await this.get(
      { workspace_id: insertObj.fk_workspace_id },
      id,
      false,
      ncMeta,
    );
  }

  public static async updateIntegration(
    context: Omit<NcContext, 'base_id'>,
    integrationId: string,
    integration: IntegrationType & {
      meta?: any;
      deleted?: boolean;
      is_encrypted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const oldIntegration = await Integration.get(
      context,
      integrationId,
      false,
      ncMeta,
    );

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
      'is_private',
      'is_encrypted',
      'is_default',
    ]);

    if (updateObj.config) {
      this.encryptConfigIfRequired(updateObj);
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

    // if global integration is updated then delete cache
    if (oldIntegration.is_global) {
      await NocoCache.deepDel(
        `${CacheScope.INTEGRATION_GLOBAL}:${oldIntegration.type}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      prepareForDb(updateObj),
      oldIntegration.id,
    );

    return this.get(context, oldIntegration.id, false, ncMeta);
  }

  static async list(
    args: {
      workspaceId?: string;
      userId: string;
      includeDatabaseInfo?: boolean;
      type?: IntegrationsType;
      sub_type?: string | ClientTypes;
      limit?: number;
      offset?: number;
      includeSourceCount?: boolean;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<PagedResponseImpl<Integration>> {
    let globalDefault: Integration;

    const { offset } = args;
    let { limit } = args;

    if (offset !== undefined && !limit) {
      limit = 25;
    }

    const qb = ncMeta.knex(MetaTable.INTEGRATIONS);

    // exclude integrations which are private and not created by user
    qb.where((whereQb) => {
      whereQb
        .where(`${MetaTable.INTEGRATIONS}.is_private`, false)
        .orWhereNull(`${MetaTable.INTEGRATIONS}.is_private`)
        .orWhere(`${MetaTable.INTEGRATIONS}.created_by`, args.userId);
    });

    // if type is provided then filter integrations based on type
    if (args.type) {
      qb.where(`${MetaTable.INTEGRATIONS}.type`, args.type);

      // get global default integration for the type if available
      globalDefault = await this.getGlobalDefault(args.type, ncMeta);

      // remove meta information from global default integration
      if (globalDefault) {
        globalDefault.created_by = null;
        globalDefault.config = null;
        globalDefault.fk_workspace_id = null;
        globalDefault.is_private = null;
      }
    }

    qb.where((whereQb) => {
      whereQb
        .where(`${MetaTable.INTEGRATIONS}.deleted`, false)
        .orWhereNull(`${MetaTable.INTEGRATIONS}.deleted`);
    }).where(`${MetaTable.INTEGRATIONS}.fk_workspace_id`, args.workspaceId);

    if (args.query) {
      qb.where(`${MetaTable.INTEGRATIONS}.title`, 'like', `%${args.query}%`);
    }

    const listQb = qb.clone();

    if (args.includeSourceCount) {
      listQb
        .select(
          `${MetaTable.INTEGRATIONS}.*`,
          ncMeta.knex.raw(`count(${MetaTable.SOURCES}.id) as source_count`),
        )
        .leftJoin(
          MetaTable.SOURCES,
          `${MetaTable.INTEGRATIONS}.id`,
          `${MetaTable.SOURCES}.fk_integration_id`,
        )
        .groupBy(`${MetaTable.INTEGRATIONS}.id`);
    }

    const integrationList = await listQb
      .limit(limit)
      .offset(offset)
      .orderBy(`${MetaTable.INTEGRATIONS}.order`, 'asc');

    // parse JSON metadata
    for (const integration of integrationList) {
      integration.meta = parseMetaProp(integration, 'meta');
    }

    const integrations = integrationList?.map((integrationData) => {
      return this.castType(integrationData);
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

    if (globalDefault) {
      integrations.unshift(globalDefault);
    }

    if (limit) {
      const count =
        +(
          await qb
            .count(`${MetaTable.INTEGRATIONS}.id`, { as: 'count' })
            .first()
        )?.['count'] || 0;

      return new PagedResponseImpl(integrations, {
        count,
        limit,
        offset,
      });
    }

    return new PagedResponseImpl(integrations, {
      count: integrations.length,
      limit: integrations.length,
    });
  }

  static async get(
    context: Omit<NcContext, 'base_id'>,
    id: string,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Integration> {
    /*
      This is a special scenario as we need to allow fetching global integrations without workspace_id
      So, we pass bypass as context & manually add workspace_id condition with exclusion of global integrations
    */
    const integrationData = await ncMeta.metaGet2(
      RootScopes.BYPASS,
      RootScopes.BYPASS,
      MetaTable.INTEGRATIONS,
      id,
      null,
      force
        ? {
            _and: [
              ...(context.workspace_id &&
              context.workspace_id !== RootScopes.BYPASS
                ? [
                    {
                      _or: [
                        {
                          fk_workspace_id: {
                            eq: context.workspace_id,
                          },
                        },
                        {
                          is_global: {
                            eq: true,
                          },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          }
        : {
            _and: [
              ...(context.workspace_id &&
              context.workspace_id !== RootScopes.BYPASS
                ? [
                    {
                      _or: [
                        {
                          fk_workspace_id: {
                            eq: context.workspace_id,
                          },
                        },
                        {
                          is_global: {
                            eq: true,
                          },
                        },
                      ],
                    },
                  ]
                : []),
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
            ],
          },
    );

    if (integrationData) {
      integrationData.meta = parseMetaProp(integrationData, 'meta');
    }

    return this.castType(integrationData);
  }

  static async getCategoryDefault(
    context: Omit<NcContext, 'base_id'>,
    type: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Integration> {
    if (context.workspace_id === RootScopes.BYPASS) {
      NcError.badRequest(
        'Workspace ID is required for getting default integration',
      );
    }

    let integrationData = await ncMeta.metaGet2(
      context.workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      { type, fk_workspace_id: context.workspace_id },
      null,
      {
        _and: [
          {
            is_default: {
              eq: true,
            },
          },
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
        ],
      },
    );

    // try to get global default integration if workspace default integration is not found
    if (!integrationData) {
      integrationData = await this.getGlobalDefault(type, ncMeta);
    }

    if (integrationData) {
      integrationData.meta = parseMetaProp(integrationData, 'meta');
    }

    return this.castType(integrationData);
  }

  static async getGlobalDefault(
    type: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Integration> {
    let integrationData = await NocoCache.get(
      `${CacheScope.INTEGRATION_GLOBAL}:${type}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (integrationData === 'NONE') {
      return null;
    }

    if (!integrationData) {
      integrationData = await ncMeta.metaGet2(
        RootScopes.BYPASS,
        RootScopes.BYPASS,
        MetaTable.INTEGRATIONS,
        { type, is_global: true },
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

      if (integrationData) {
        await NocoCache.set(
          `${CacheScope.INTEGRATION_GLOBAL}:${type}`,
          integrationData,
        );
      } else {
        await NocoCache.set(`${CacheScope.INTEGRATION_GLOBAL}:${type}`, 'NONE');
      }
    }

    return this.castType(integrationData);
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
    const config = decryptPropIfRequired({
      data: this,
    });

    return config;
  }

  async delete(ncMeta = Noco.ncMeta) {
    // delete global integration cache for the type
    if (this.is_global) {
      await NocoCache.deepDel(
        `${CacheScope.INTEGRATION_GLOBAL}:${this.type}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    const res = await ncMeta.metaDelete(
      this.fk_workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      this.id,
    );

    return res;
  }

  async softDelete(ncMeta = Noco.ncMeta) {
    await ncMeta.metaUpdate(
      this.fk_workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        deleted: true,
      },
      this.id,
    );
  }

  async getSources(ncMeta = Noco.ncMeta): Promise<any> {
    const qb = ncMeta.knex(MetaTable.SOURCES);

    const sources = await qb
      .select(`${MetaTable.SOURCES}.id`)
      .select(`${MetaTable.SOURCES}.alias`)
      .select(`${MetaTable.PROJECT}.title as project_title`)
      .select(`${MetaTable.SOURCES}.base_id`)
      .innerJoin(
        MetaTable.PROJECT,
        `${MetaTable.SOURCES}.base_id`,
        `${MetaTable.PROJECT}.id`,
      )
      .where(`${MetaTable.SOURCES}.fk_integration_id`, this.id)
      .where((whereQb) => {
        whereQb
          .where(`${MetaTable.SOURCES}.deleted`, false)
          .orWhereNull(`${MetaTable.SOURCES}.deleted`);
      })
      .where((whereQb) => {
        whereQb
          .where(`${MetaTable.PROJECT}.deleted`, false)
          .orWhereNull(`${MetaTable.PROJECT}.deleted`);
      })
      .where(`${MetaTable.SOURCES}.fk_workspace_id`, this.fk_workspace_id);

    return (this.sources = sources);
  }
}
