import { Injectable } from '@nestjs/common';
import { AppEvents, ClientType } from 'nocodb-sdk';
import { IntegrationsType } from 'nocodb-sdk';
import type { IntegrationReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Base, Integration } from '~/models';
import { NcBaseError, NcError } from '~/helpers/catchError';
import { Source } from '~/models';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { InstanceCommands } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';
import { generateUniqueName } from '~/helpers/exportImportHelpers';

@Injectable()
export class IntegrationsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly sourcesService: SourcesService,
  ) {}

  async integrationGetWithConfig(
    context: NcContext,
    param: { integrationId: any; includeSources?: boolean },
  ) {
    const integration = await Integration.get(context, param.integrationId);

    if (!integration) {
      NcError.integrationNotFound(param.integrationId);
    }

    integration.config = await integration.getConnectionConfig();

    if (param.includeSources) {
      await integration.getSources();
    }

    return integration;
  }

  async integrationUpdate(
    context: NcContext,
    param: {
      integrationId: string;
      integration: IntegrationReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/IntegrationReq',
      param.integration,
    );
    const oldIntegration = await Integration.get(context, param.integrationId);

    const integrationBody = param.integration;
    const integration = await Integration.updateIntegration(
      context,
      param.integrationId,
      {
        ...integrationBody,
        id: param.integrationId,
      },
    );

    // update the cache for the sources which are using this integration
    await this.updateIntegrationSourceConfig({ integration });

    integration.config = undefined;

    this.appHooksService.emit(AppEvents.INTEGRATION_UPDATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      oldIntegration,
      context: {
        ...context,
        base_id: null,
      },
    });

    return integration;
  }

  async integrationList(param: {
    req: NcRequest;
    includeDatabaseInfo: boolean;
    type?: IntegrationsType;
    limit?: number;
    offset?: number;
    query?: string;
  }) {
    const integrations = await Integration.list({
      userId: param.req.user?.id,
      includeDatabaseInfo: param.includeDatabaseInfo,
      type: param.type,
      includeSourceCount: true,
      query: param.query,
    });

    return integrations;
  }

  async integrationDelete(
    context: Omit<NcContext, 'base_id'>,
    param: { integrationId: string; req: any; force: boolean },
  ) {
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      const integration = await Integration.get(
        context,
        param.integrationId,
        true,
        ncMeta,
      );

      if (!integration) {
        NcError.integrationNotFound(param.integrationId);
      }

      // get linked sources
      const sourceListQb = ncMeta
        .knex(MetaTable.SOURCES)
        .where({
          fk_integration_id: integration.id,
        })
        .where((qb) => {
          qb.where('deleted', false).orWhere('deleted', null);
        });

      if (integration.fk_workspace_id) {
        sourceListQb.where('fk_workspace_id', integration.fk_workspace_id);
      }

      const sources: Pick<Source, 'id' | 'base_id'>[] =
        await sourceListQb.select('id', 'base_id');

      if (sources.length > 0 && !param.force) {
        const bases = await Promise.all(
          sources.map(async (source) => {
            return await Base.get(
              {
                workspace_id: integration.fk_workspace_id,
                base_id: source.base_id,
              },
              source.base_id,
              ncMeta,
            );
          }),
        );

        NcError.integrationLinkedWithMultiple(bases, sources);
      }

      await integration.delete(ncMeta);
      this.appHooksService.emit(AppEvents.INTEGRATION_DELETE, {
        integration,
        req: param.req,
        user: param.req?.user,
        context: {
          ...context,
          base_id: null,
        },
      });

      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback(e);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      NcError.badRequest(e);
    }

    return true;
  }

  async integrationSoftDelete(
    context: Omit<NcContext, 'base_id'>,
    param: { integrationId: string; req: any },
  ) {
    try {
      const integration = await Integration.get(context, param.integrationId);
      if (!integration) {
        NcError.integrationNotFound(param.integrationId);
      }

      const ncMeta = await Noco.ncMeta.startTransaction();
      try {
        // get linked sources
        const sourceListQb = ncMeta
          .knex(MetaTable.SOURCES)
          .where({
            fk_integration_id: integration.id,
          })
          .where((qb) => {
            qb.where('deleted', false).orWhere('deleted', null);
          });

        if (integration.fk_workspace_id) {
          sourceListQb.where('fk_workspace_id', integration.fk_workspace_id);
        }

        const sources: Pick<Source, 'id' | 'base_id'>[] =
          await sourceListQb.select('id', 'base_id');

        for (const source of sources) {
          await this.sourcesService.baseSoftDelete(
            {
              workspace_id: integration.fk_workspace_id,
              base_id: source.base_id,
            },
            {
              sourceId: source.id,
            },
            ncMeta,
          );
        }

        await integration.softDelete(ncMeta);
        this.appHooksService.emit(AppEvents.INTEGRATION_DELETE, {
          integration,
          req: param.req,
          user: param.req?.user,
        });

        await ncMeta.commit();
      } catch (e) {
        await ncMeta.rollback(e);
        if (e instanceof NcError || e instanceof NcBaseError) throw e;
        NcError.badRequest(e);
      }
    } catch (e) {
      NcError.badRequest(e);
    }

    return true;
  }

  async integrationCreate(
    context: NcContext,
    param: {
      integration: IntegrationReqType;
      logger?: (message: string) => void;
      req: any;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/IntegrationReq',
      param.integration,
    );

    let integrationBody;

    if (param.integration.copy_from_id) {
      integrationBody = await Integration.get(
        context,
        param.integration.copy_from_id,
      );

      if (!integrationBody?.id) {
        NcError.integrationNotFound(param.integration.copy_from_id);
      }

      integrationBody.config = await integrationBody.getConnectionConfig();
    } else {
      integrationBody = param.integration;
    }
    param.logger?.('Creating the integration');

    // for SQLite check for existing integration which refers to the same file
    if (integrationBody.sub_type === 'sqlite3') {
      // get all integrations of type sqlite3
      const integrations = await Integration.list({
        userId: param.req.user?.id,
        includeDatabaseInfo: true,
        type: IntegrationsType.Database,
        sub_type: ClientType.SQLITE,
        includeSourceCount: false,
        query: '',
      });

      if (integrations.list && integrations.list.length > 0) {
        for (const integration of integrations.list) {
          const config = integration.config as any;
          if (
            (config?.connection?.filename ||
              config?.connection?.connection?.filename) ===
            (integrationBody.config?.connection?.filename ||
              integrationBody.config?.connection?.connection?.filename)
          ) {
            NcError.badRequest('Integration with same file already exists');
          }
        }
      }
    }

    let uniqueTitle = '';

    if (param.integration.copy_from_id) {
      const integrations =
        (
          await Integration.list({
            userId: param.req.user?.id,
            includeSourceCount: false,
            query: '',
          })
        ).list || [];

      uniqueTitle = generateUniqueName(
        `${integrationBody.title} copy`,
        integrations.map((p) => p.title),
      );
    }

    const integration = await Integration.createIntegration({
      ...integrationBody,
      ...(param.integration.copy_from_id ? { title: uniqueTitle } : {}),
      created_by: param.req.user.id,
    });

    integration.config = undefined;

    this.appHooksService.emit(AppEvents.INTEGRATION_CREATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      context: {
        ...context,
        base_id: null,
      },
    });

    return integration;
  }

  async integrationStore(
    context: NcContext,
    integration: Integration,
    payload?:
      | {
          op: 'list';
          limit: number;
          offset: number;
        }
      | {
          op: 'get';
        }
      | {
          op: 'sum';
          fields: string[];
        },
  ) {
    if (payload.op === 'list') {
      return await integration.storeList(
        context,
        payload.limit,
        payload.offset,
      );
    } else if (payload.op === 'sum') {
      return await integration.storeSum(context, payload.fields);
    } else if (payload.op === 'get') {
      return await integration.storeGetLatest(context);
    }
  }

  // function to update all the integration source config which are using this integration
  // we are overwriting the source config with the new integration config excluding database name and schema name
  protected async updateIntegrationSourceConfig(
    {
      integration,
    }: {
      integration: Integration;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // get all the bases which are using this integration
    const sources = await ncMeta.metaList2(
      integration.fk_workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.SOURCES,
      {
        condition: {
          fk_integration_id: integration.id,
        },
        xcCondition: {
          _or: [
            {
              deleted: {
                eq: false,
              },
            },
            {
              deleted: {
                eq: null,
              },
            },
          ],
        },
      },
    );

    // iterate and update the cache for the sources
    for (const sourceObj of sources) {
      const source = new Source(sourceObj);

      // update the cache with the new config(encrypted)
      await NocoCache.update(`${CacheScope.SOURCE}:${source.id}`, {
        integration_config: integration.config,
      });

      // delete the connection ref
      await NcConnectionMgrv2.deleteAwait(source);

      // release the connections from the worker
      if (JobsRedis.available) {
        await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, source.id);
        await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, source.id);
      }
    }
  }

  public async callIntegrationEndpoint(
    context: NcContext,
    params: {
      integrationId: string;
      endpoint: string;
      payload?: any;
    },
  ) {
    const integration = await Integration.get(context, params.integrationId);

    const integrationMeta = integration.getIntegrationMeta();

    const wrapper = integration.getIntegrationWrapper();

    if (!integrationMeta || !wrapper) {
      NcError.badRequest('Invalid integration');
    }

    if (
      !integrationMeta.exposedEndpoints?.includes(params.endpoint) ||
      !(params.endpoint in wrapper) ||
      typeof wrapper[params.endpoint] !== 'function'
    ) {
      NcError.genericNotFound('Endpoint', params.endpoint);
    }

    return wrapper[params.endpoint](context, params.payload);
  }
}
