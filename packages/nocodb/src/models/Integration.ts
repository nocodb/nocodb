import type { IntegrationsType, SourceType } from 'nocodb-sdk';
import type { BoolType, IntegrationType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
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

  public static async createIntegration(
    integration: IntegrationType & {
      workspaceId?: string;
      created_at?;
      updated_at?;
      meta?: any;
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
      context.workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      prepareForDb(updateObj),
      oldIntegration.id,
    );

    // call before reorder to update cache
    const returnBase = await this.get(
      context,
      oldIntegration.id,
      false,
      ncMeta,
    );

    return returnBase;
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
          // extract params related to sqlite
          ['connection', 'filepath'],
          ['connection', 'connection', 'filepath'],
          ['searchPath'],
        ]);
      }
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
    const integrationData = await ncMeta.metaGet2(
      context.workspace_id,
      context.workspace_id === RootScopes.BYPASS
        ? RootScopes.BYPASS
        : RootScopes.WORKSPACE,
      MetaTable.INTEGRATIONS,
      !context.workspace_id || context.workspace_id === RootScopes.BYPASS
        ? id
        : { id, fk_workspace_id: context.workspace_id },
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
      });

    return (this.sources = sources);
  }
}
