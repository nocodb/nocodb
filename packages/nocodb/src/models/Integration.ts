import {
  type BoolType,
  integrationCategoryNeedDefault,
  IntegrationsType,
  type IntegrationType,
  type SourceType,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { setExternalDbSsrfEnforcement } from '@noco-local-integrations/core';
import type { ClientType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type {
  IntegrationEntry,
  IntegrationWrapper,
} from '@noco-local-integrations/core';
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
  isCloud,
  isEncryptionRequired,
  partialExtract,
} from '~/utils';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { IntegrationStore, Source } from '~/models';
import Integrations from '~/integrations';

const logger = new Logger('Integration');

export default class Integration implements IntegrationType {
  public static availableIntegrations: IntegrationEntry[] = Integrations;

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
  is_restricted?: BoolType;
  is_encrypted?: BoolType;
  meta?: any;
  created_by?: string;
  sources?: Partial<SourceType>[];
  environments?: { fk_environment_id: string; config?: Record<string, any> }[];

  constructor(integration: Partial<IntegrationType>) {
    Object.assign(this, integration);
  }

  protected static castType(integration: Integration): Integration {
    return integration && new Integration(integration);
  }

  public static async init() {
    // Force SSRF enforcement on cloud regardless of env-var bypasses. Done here
    // at bootstrap rather than at module load: `isCloud` comes from a barrel
    // (`~/utils`) that sits in a circular import with this model, so reading it
    // at module-evaluation time throws a temporal-dead-zone ReferenceError.
    setExternalDbSsrfEnforcement(isCloud);
  }

  public static async createIntegration(
    integration: IntegrationType & {
      workspaceId?: string;
      created_at?;
      updated_at?;
      meta?: any;
      is_default?: BoolType;
      is_encrypted?: BoolType;
      is_restricted?: BoolType;
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
      'fk_workspace_id',
      'is_restricted',
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

    // First integration of a default-needing category becomes the default.
    if (integrationCategoryNeedDefault(insertObj.type)) {
      const defaultIntegration = await this.getCategoryDefault(
        {
          workspace_id: insertObj.fk_workspace_id,
        },
        insertObj.type,
        undefined,
        ncMeta,
      );

      insertObj.is_default = !defaultIntegration;
    }

    const { id } = await ncMeta.metaInsert2(
      insertObj.fk_workspace_id
        ? insertObj.fk_workspace_id
        : RootScopes.WORKSPACE,
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
      is_restricted?: BoolType;
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
      'is_restricted',
    ]);

    if (updateObj.config) {
      this.encryptConfigIfRequired(updateObj);
    }

    // `type` may arrive as an explicit undefined — never null it out.
    if (!updateObj.type) {
      updateObj.type = oldIntegration.type;
    }

    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // Rows created before ordering existed have no `order` — backfill.
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

    return await this.get(context, oldIntegration.id, false, ncMeta);
  }

  /** Make this integration its category's default, demoting the current one. */
  public static async setDefault(
    context: Omit<NcContext, 'base_id'>,
    integrationId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const integration = await this.get(context, integrationId, false, ncMeta);

    if (!integration) {
      NcError.integrationNotFound(integrationId);
    }

    if (integration.is_default) {
      return integration;
    }

    const defaultIntegration = await this.getCategoryDefault(
      {
        workspace_id: context.workspace_id,
      },
      integration.type,
      undefined,
      ncMeta,
    );

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

    // Private integrations are visible only to their creator.
    qb.where((whereQb) => {
      whereQb
        .where(`${MetaTable.INTEGRATIONS}.is_private`, false)
        .orWhereNull(`${MetaTable.INTEGRATIONS}.is_private`)
        .orWhere(`${MetaTable.INTEGRATIONS}.created_by`, args.userId);
    });

    if (args.type) {
      qb.where(`${MetaTable.INTEGRATIONS}.type`, args.type);
    }
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

    for (const integration of integrationList) {
      integration.meta = parseMetaProp(integration, 'meta');
    }

    const integrations = integrationList?.map((integrationData) => {
      return this.castType(integrationData);
    });

    // Non-secret connection facts only (client, database name, sqlite file).
    if (args.includeDatabaseInfo) {
      for (const integration of integrations) {
        const config = integration.getConfig();
        integration.config = partialExtract(config, [
          'client',
          ['connection', 'database'],
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
      context.workspace_id && context.workspace_id !== RootScopes.BYPASS
        ? context.workspace_id
        : RootScopes.BYPASS,
      context.workspace_id && context.workspace_id !== RootScopes.BYPASS
        ? RootScopes.WORKSPACE
        : RootScopes.BYPASS,
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

  static async getCategoryDefault(
    context: Omit<NcContext, 'base_id'>,
    type: string,
    _opts: { preferGlobal?: boolean } = {},
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

  protected static encryptConfigIfRequired(obj: Record<string, unknown>) {
    obj.config = encryptPropIfRequired({ data: obj });
    obj.is_encrypted = isEncryptionRequired();
  }

  public getConfig(): any {
    const config = decryptPropIfRequired({
      data: this,
    });

    return config;
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

  public wrapper: IntegrationWrapper;

  getIntegrationWrapper<T = any>(pLogger?: (message: string) => void) {
    if (!this.wrapper) {
      const IntegrationClass = this.constructor as typeof Integration;

      const integrationWrapper = IntegrationClass.availableIntegrations.find(
        (el) => el.type === this.type && el.sub_type === this.sub_type,
      );

      if (!integrationWrapper) {
        logger.error('Integration not found');
        NcError._.internalServerError('Integration not found');
      }

      this.wrapper = new integrationWrapper.wrapper(this.getWrapperConfig(), {
        saveConfig: async (config: any) => {
          await this.persistWrapperConfig(config);
        },
        logger: pLogger,
      });

      // Refreshed OAuth tokens persist back to the slot the config came from
      // (production / env override / user row — see persistWrapperConfig).
      if (
        this.type === IntegrationsType.Auth &&
        this.wrapper &&
        typeof (this.wrapper as any).setTokenRefreshCallback === 'function'
      ) {
        (this.wrapper as any).setTokenRefreshCallback(
          async (tokens: { oauth_token: string; refresh_token?: string }) => {
            await this.persistWrapperConfig({
              ...this.getWrapperConfig(),
              ...tokens,
            });
          },
        );
      }
    }

    return this.wrapper as T;
  }

  /**
   * The config the integration client is built from. Defaults to the
   * integration's own (production) config. EE overrides this to return a
   * per-environment override or a per-user credential when the instance has
   * been bound (see EE `applyEnvironment` / `applyUserCredential`).
   */
  protected getWrapperConfig(): any {
    return this.getConfig();
  }

  /**
   * Public accessor for the effective, binding-aware config: the integration's
   * own (production) config, or the per-environment override / per-user
   * credential once the instance has been bound via EE `applyEnvironment()` /
   * `applyUserCredential()`. Use at data-plane sites that build a throwaway
   * wrapper (`tempIntegrationWrapper`) with their own connection lifecycle,
   * rather than going through `getIntegrationWrapper()`. On an unbound instance
   * (or in CE) this is identical to `getConfig()`.
   */
  public getEffectiveConfig(): any {
    return this.getWrapperConfig();
  }

  /**
   * Persist a config the wrapper produced (OAuth token exchange / refresh).
   * Defaults to the integration's own config. EE routes it to the bound
   * per-environment override or per-user row, so refreshed tokens never
   * overwrite production credentials.
   */
  protected async persistWrapperConfig(config: any): Promise<void> {
    const IntegrationClass = this.constructor as typeof Integration;
    await IntegrationClass.updateIntegration(
      { workspace_id: this.fk_workspace_id },
      this.id,
      { config },
    );
  }

  /** Build a throwaway wrapper from an arbitrary config (no persistence hooks). */
  static tempIntegrationWrapper<T = any>(config: Partial<IntegrationType>) {
    const integrationWrapper = Integration.availableIntegrations.find(
      (el) => el.type === config.type && el.sub_type === config.sub_type,
    );

    if (!integrationWrapper) {
      logger.error('Integration not found');
      NcError._.internalServerError('Integration not found');
    }

    return new integrationWrapper.wrapper(config.config, {}) as T;
  }

  static getManifestForConfig(config: Partial<IntegrationType>) {
    return Integration.availableIntegrations.find(
      (el) => el.type === config.type && el.sub_type === config.sub_type,
    )?.manifest;
  }

  getIntegrationMeta() {
    const integrationMeta = Integration.availableIntegrations.find(
      (el) => el.type === this.type && el.sub_type === this.sub_type,
    );

    if (!integrationMeta) {
      logger.error('Integration meta not found');
      NcError._.internalServerError('Integration meta not found');
    }

    return integrationMeta?.manifest;
  }

  async delete(ncMeta = Noco.ncMeta) {
    const sources = await Source.listByIntegration(
      { workspace_id: this.fk_workspace_id },
      this.id,
      { force: true },
      ncMeta,
    );

    for (const source of sources) {
      await source.delete(
        {
          workspace_id: this.fk_workspace_id,
          base_id: source.base_id,
        },
        ncMeta,
      );
    }

    await this.unbindColumnRefs(ncMeta);

    return await ncMeta.metaDelete(
      this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      this.id,
    );
  }

  async softDelete(ncMeta = Noco.ncMeta) {
    const sources = await Source.listByIntegration(
      { workspace_id: this.fk_workspace_id },
      this.id,
      { force: true },
      ncMeta,
    );

    for (const source of sources) {
      await source.softDelete(
        {
          workspace_id: this.fk_workspace_id,
          base_id: source.base_id,
        },
        ncMeta,
      );
    }

    await this.unbindColumnRefs(ncMeta);

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

  private async unbindColumnRefs(ncMeta = Noco.ncMeta) {
    for (const table of [MetaTable.COL_BUTTON, MetaTable.COL_LONG_TEXT]) {
      await ncMeta.metaUpdate(
        this.fk_workspace_id ? this.fk_workspace_id : RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        table,
        {
          fk_integration_id: null,
          model: null,
        },
        {
          fk_integration_id: this.id,
        },
      );
    }
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
