import { Integration as IntegrationCE } from 'src/models';
import { integrationCategoryNeedDefault } from 'nocodb-sdk';
import { IntegrationsType } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type {
  BoolType,
  ClientType,
  IntegrationType,
  SourceType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { AuthIntegration } from '@noco-integrations/core';
import { MetaTable, RootScopes } from '~/utils/globals';
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
import { Source } from '~/models';

const logger = new Logger('Integration');

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

  static globalIntegrations?: Integration[] = [];

  constructor(integration: Partial<IntegrationType>) {
    super(integration);
  }

  protected static castType(integration: Integration): Integration {
    return integration && new Integration(integration);
  }

  public static async init() {
    Integration.availableIntegrations = [];
    IntegrationCE.availableIntegrations = Integration.availableIntegrations;

    for (const tp of Object.values(IntegrationsType)) {
      if (!integrationCategoryNeedDefault(tp as IntegrationsType)) continue;

      const env = process.env[`NC_INTEGRATION_${tp.toUpperCase()}`];
      if (env) {
        try {
          const integration = JSON.parse(env);
          if (integration) {
            integration.id = `global_${tp}`;
            integration.is_global = true;
            Integration.globalIntegrations.push(integration);
          }
        } catch (e) {
          logger.error(e);
        }
      }
    }
  }

  public static async createIntegration(
    integration: IntegrationType & {
      workspaceId: string;
      created_at?;
      updated_at?;
      meta?: any;
      is_encrypted?: boolean;
      is_default?: boolean;
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
    ]);

    this.encryptConfigIfRequired(insertObj);

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

    const int = await this.get(
      { workspace_id: insertObj.fk_workspace_id },
      id,
      false,
      ncMeta,
    );

    return int;
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

    await ncMeta.metaUpdate(
      context.workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      prepareForDb(updateObj),
      oldIntegration.id,
    );

    const int = await this.get(context, oldIntegration.id, false, ncMeta);
    return int;
  }

  static async list(
    args: {
      workspaceId?: string;
      userId: string;
      includeDatabaseInfo?: boolean;
      type?: IntegrationsType;
      sub_type?: string | ClientType;
      includeSourceCount?: boolean;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<PagedResponseImpl<Integration>> {
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

    const integrationList = await listQb.orderBy(
      `${MetaTable.INTEGRATIONS}.order`,
      'asc',
    );

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

    if (args.type) {
      const globals = this.globalIntegrations.filter(
        (i) => i.type === args.type,
      );

      if (globals.length) {
        integrations.push(...globals);
      }
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
    const globalIntegration = await Integration.globalIntegrations.find(
      (i) => i.id === id,
    );

    if (globalIntegration) {
      return this.castType(globalIntegration);
    }

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
                      fk_workspace_id: {
                        eq: context.workspace_id,
                      },
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
                      fk_workspace_id: {
                        eq: context.workspace_id,
                      },
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
      const globalIntegration = this.globalIntegrations.find(
        (i) => i.type === type,
      );

      if (globalIntegration) {
        integrationData = globalIntegration;
      }
    }

    if (integrationData) {
      integrationData.meta = parseMetaProp(integrationData, 'meta');
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
    if (this.is_global) {
      return this.config;
    }

    const config = decryptPropIfRequired({
      data: this,
    });

    return config;
  }

  async getSources(ncMeta = Noco.ncMeta, force = false): Promise<Source[]> {
    const qb = ncMeta.knex(MetaTable.SOURCES);

    qb.select(`${MetaTable.SOURCES}.id`)
      .select(`${MetaTable.SOURCES}.alias`)
      .select(`${MetaTable.PROJECT}.title as project_title`)
      .select(`${MetaTable.SOURCES}.base_id`)
      .innerJoin(
        MetaTable.PROJECT,
        `${MetaTable.SOURCES}.base_id`,
        `${MetaTable.PROJECT}.id`,
      )
      .where(`${MetaTable.SOURCES}.fk_integration_id`, this.id)
      .where(`${MetaTable.SOURCES}.fk_workspace_id`, this.fk_workspace_id);

    if (!force) {
      qb.where((whereQb) => {
        whereQb
          .where(`${MetaTable.SOURCES}.deleted`, false)
          .orWhereNull(`${MetaTable.SOURCES}.deleted`);
      }).where((whereQb) => {
        whereQb
          .where(`${MetaTable.PROJECT}.deleted`, false)
          .orWhereNull(`${MetaTable.PROJECT}.deleted`);
      });
    }

    const sources = await qb;

    return (this.sources = sources.map((src) => new Source(src)));
  }

  async authenticateOAuth() {
    if (this.type !== IntegrationsType.Auth) {
      return;
    }

    const config = this.getConfig();

    if (!config?.oauth) {
      return;
    }

    const { oauth, ...rest } = config;

    const wrapper = await this.getIntegrationWrapper<AuthIntegration>();

    const exchangedConfig = await wrapper.exchangeToken(oauth);

    await Integration.updateIntegration(
      { workspace_id: this.fk_workspace_id },
      this.id,
      {
        config: {
          ...rest,
          ...exchangedConfig,
        },
      },
    );
  }
}
