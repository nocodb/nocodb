import {
  type BoolType,
  type FormDefinition,
  integrationCategoryNeedDefault,
  type IntegrationsType,
  type IntegrationType,
  type SourceType,
} from 'nocodb-sdk';
import type { ClientType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type IntegrationWrapper from '~/integrations/integration.wrapper';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import {
  parseMetaProp,
  prepareForDb,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import {
  decryptPropIfRequired,
  encryptPropIfRequired,
  isEncryptionRequired,
  partialExtract,
} from '~/utils';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { IntegrationStore, Source } from '~/models';

export default class Integration implements IntegrationType {
  public static availableIntegrations: {
    type: IntegrationsType;
    sub_type: string;
    form?: FormDefinition;
    wrapper?: typeof IntegrationWrapper;
    meta?: {
      title?: string;
      value?: string;
      icon?: string;
      description?: string;
      exposedEndpoints?: string[];
    };
  }[];

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
  meta?: any;
  created_by?: string;
  sources?: Partial<SourceType>[];
  is_encrypted?: BoolType;

  constructor(integration: Partial<IntegrationType>) {
    Object.assign(this, integration);
  }

  protected static castType(integration: Integration): Integration {
    return integration && new Integration(integration);
  }

  protected static encryptConfigIfRequired(obj: Record<string, unknown>) {
    obj.config = encryptPropIfRequired({ data: obj });
    obj.is_encrypted = isEncryptionRequired();
  }

  public static async init() {
    // we use dynamic import to avoid circular reference
    Integration.availableIntegrations = (
      await import('src/integrations/integrations')
    ).default;
  }

  public static async createIntegration(
    integration: IntegrationType & {
      workspaceId?: string;
      created_at?;
      updated_at?;
      meta?: any;
      is_default?: BoolType;
      is_encrypted?: BoolType;
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
      'is_default',
      'is_encrypted',
    ]);

    this.encryptConfigIfRequired(insertObj);

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    if (integration.workspaceId)
      insertObj.fk_workspace_id =
        insertObj.fk_workspace_id || integration.workspaceId;

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.INTEGRATIONS,
      insertObj.fk_workspace_id
        ? {
            fk_workspace_id: insertObj.fk_workspace_id,
          }
        : {},
    );

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
      if (defaultIntegration) {
        insertObj.is_default = false;
      } else {
        insertObj.is_default = true;
      }
    }

    const { id } = await ncMeta.metaInsert2(
      insertObj.fk_workspace_id
        ? insertObj.fk_workspace_id
        : RootScopes.WORKSPACE,
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
      'is_default',
      'is_encrypted',
    ]);

    if (updateObj.config) {
      updateObj.config = encryptPropIfRequired({
        data: updateObj,
      });
      updateObj.is_encrypted = isEncryptionRequired();

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
      context.workspace_id ? context.workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      prepareForDb(updateObj),
      oldIntegration.id,
    );

    // call before reorder to update cache
    const int = await this.get(context, oldIntegration.id, false, ncMeta);

    return int;
  }

  public static async setDefault(
    context: Omit<NcContext, 'base_id'>,
    integrationId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const integration = await this.get(context, integrationId, false, ncMeta);

    if (!integration) {
      NcError.integrationNotFound(integrationId);
    }

    // return if integration is already default
    if (integration.is_default) {
      return integration;
    }

    // get if default integration exists for the type
    const defaultIntegration = await this.getCategoryDefault(
      {
        workspace_id: context.workspace_id,
      },
      integration.type,
      ncMeta,
    );

    // if default integration already exists then set is_default to false
    if (defaultIntegration) {
      await ncMeta.metaUpdate(
        context.workspace_id ? context.workspace_id : RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.INTEGRATIONS,
        {
          is_default: false,
        },
        defaultIntegration.id,
      );
    }

    await ncMeta.metaUpdate(
      context.workspace_id ? context.workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        is_default: true,
      },
      integrationId,
    );

    return await this.get(context, integrationId, false, ncMeta);
  }

  static async list(
    args: {
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
    // if sub_type is provided then filter integrations based on sub_type
    if (args.sub_type) {
      qb.where(`${MetaTable.INTEGRATIONS}.sub_type`, args.sub_type);
    }

    qb.where((whereQb) => {
      whereQb
        .where(`${MetaTable.INTEGRATIONS}.deleted`, false)
        .orWhereNull(`${MetaTable.INTEGRATIONS}.deleted`);
    });

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
          // extract params related to sqlite
          ['connection', 'filepath'],
          ['connection', 'connection', 'filepath'],
          ['searchPath'],
        ]);
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
    const integrationData = await ncMeta.metaGet2(
      context.workspace_id ? context.workspace_id : RootScopes.BYPASS,
      context.workspace_id ? RootScopes.WORKSPACE : RootScopes.BYPASS,
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
    const config = decryptPropIfRequired({
      data: this,
    });

    return config;
  }

  async delete(ncMeta = Noco.ncMeta) {
    const sources = await this.getSources(ncMeta, true);

    for (const source of sources) {
      await source.delete(
        {
          workspace_id: this.fk_workspace_id,
          base_id: source.base_id,
        },
        ncMeta,
      );
    }

    // unbind all buttons and long texts associated with this integration
    await ncMeta.metaUpdate(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.COL_BUTTON,
      {
        fk_integration_id: null,
        model: null,
      },
      {
        fk_integration_id: this.id,
      },
    );

    await ncMeta.metaUpdate(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.COL_LONG_TEXT,
      {
        fk_integration_id: null,
        model: null,
      },
      {
        fk_integration_id: this.id,
      },
    );

    return await ncMeta.metaDelete(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      this.id,
    );
  }

  async softDelete(ncMeta = Noco.ncMeta) {
    const sources = await this.getSources(ncMeta, true);

    for (const source of sources) {
      await source.softDelete(
        {
          workspace_id: this.fk_workspace_id,
          base_id: source.base_id,
        },
        ncMeta,
      );
    }

    // unbind all buttons and long texts associated with this integration
    await ncMeta.metaUpdate(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.COL_BUTTON,
      {
        fk_integration_id: null,
        model: null,
      },
      {
        fk_integration_id: this.id,
      },
    );

    await ncMeta.metaUpdate(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.COL_LONG_TEXT,
      {
        fk_integration_id: null,
        model: null,
      },
      {
        fk_integration_id: this.id,
      },
    );

    await ncMeta.metaUpdate(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      {
        deleted: true,
      },
      this.id,
    );
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
      .where(`${MetaTable.SOURCES}.fk_integration_id`, this.id);

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

  static async getCategoryDefault(
    context: Omit<NcContext, 'base_id'>,
    type: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Integration> {
    const integrationData = await ncMeta.metaGet2(
      context.workspace_id ? context.workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      { type },
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

    if (integrationData) {
      integrationData.meta = parseMetaProp(integrationData, 'meta');
    }

    return this.castType(integrationData);
  }

  public wrapper: IntegrationWrapper;

  getIntegrationWrapper<T extends IntegrationWrapper>() {
    if (!this.wrapper) {
      const integrationWrapper = Integration.availableIntegrations.find(
        (el) => el.type === this.type && el.sub_type === this.sub_type,
      );

      if (!integrationWrapper) {
        throw new Error('Integration not found');
      }

      this.wrapper = new integrationWrapper.wrapper(this);
    }

    return this.wrapper as T;
  }

  getIntegrationMeta() {
    const integrationMeta = Integration.availableIntegrations.find(
      (el) => el.type === this.type && el.sub_type === this.sub_type,
    );

    if (!integrationMeta) {
      throw new Error('Integration meta not found');
    }

    return integrationMeta?.meta;
  }

  async storeInsert(
    context: Omit<NcContext, 'base_id'>,
    fk_user_id: string | null,
    data: Record<string, any>,
    ncMeta = Noco.ncMeta,
  ) {
    return await IntegrationStore.insert(
      context,
      this,
      fk_user_id,
      data,
      ncMeta,
    );
  }

  async storeList(
    context: Omit<NcContext, 'base_id'>,
    limit: number,
    offset: number,
    ncMeta = Noco.ncMeta,
  ) {
    return await IntegrationStore.list(
      context,
      this,
      {
        limit,
        offset,
      },
      ncMeta,
    );
  }

  async storeSum(
    context: Omit<NcContext, 'base_id'>,
    fields: string | string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!Array.isArray(fields)) {
      fields = [fields];
    }

    return await IntegrationStore.sum(context, this, fields, ncMeta);
  }

  async storeGetLatest(
    context: Omit<NcContext, 'base_id'>,
    ncMeta = Noco.ncMeta,
  ) {
    return await IntegrationStore.getLatest(context, this, ncMeta);
  }
}
