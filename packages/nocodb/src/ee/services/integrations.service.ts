import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { IntegrationsService as IntegrationsServiceCE } from 'src/services/integrations.service';
import type {
  AuthIntegration,
  TestConnectionResponse,
} from '@noco-local-integrations/core';
import type { IntegrationReqType, IntegrationsType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { validatePayload } from '~/helpers';
import { Base, Integration } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Source, Workspace } from '~/models';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { InstanceCommands } from '~/interface/Jobs';
import { generateUniqueName } from '~/helpers/exportImportHelpers';

@Injectable()
export class IntegrationsService extends IntegrationsServiceCE {
  async integrationGetWithConfig(
    context: NcContext,
    param: { integrationId: any; includeSources?: boolean },
  ) {
    const integration = await Integration.get(context, param.integrationId);

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

    if (!oldIntegration) {
      NcError.integrationNotFound(param.integrationId);
    }
    const integrationBody = param.integration;
    const integration = await Integration.updateIntegration(
      context,
      param.integrationId,
      {
        ...integrationBody,
        id: param.integrationId,
      },
    );

    await integration.authenticateOAuth();

    // update the cache for the sources which are using this integration
    await this.updateIntegrationSourceConfig({ integration });

    integration.config = undefined;

    this.appHooksService.emit(AppEvents.INTEGRATION_UPDATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      context,
      oldIntegration,
    });

    return integration;
  }

  async integrationSetDefault(
    context: NcContext,
    param: {
      integrationId: string;
      req: NcRequest;
    },
  ) {
    const oldIntegration = await Integration.get(context, param.integrationId);

    if (!oldIntegration) {
      NcError.integrationNotFound(param.integrationId);
    }

    const integration = await Integration.setDefault(
      context,
      param.integrationId,
    );

    integration.config = undefined;

    this.appHooksService.emit(AppEvents.INTEGRATION_UPDATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      oldIntegration,
      context,
    });

    return integration;
  }

  async integrationList(param: {
    workspaceId: string;
    req: NcRequest;
    includeDatabaseInfo: boolean;
    type?: IntegrationsType;
    limit?: number;
    offset?: number;
    query?: string;
  }) {
    // const haveWorkspaceLevelPermission = Object.keys(
    //   param.req.user.workspace_roles,
    // ).some(
    //   (role) =>
    //     param.req.user.workspace_roles[role] &&
    //     [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(
    //       role as WorkspaceUserRoles,
    //     ),
    // );

    const integrations = await Integration.list({
      workspaceId: param.workspaceId,
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

      // check linked sources
      const sources = await ncMeta.metaList2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.SOURCES,
        {
          condition: {
            fk_workspace_id: context.workspace_id,
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

      if (sources.length > 0 && !param.force) {
        const bases = await Promise.all(
          sources.map(async (source) => {
            return await Base.get(
              {
                workspace_id: context.workspace_id,
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
          fk_model_id: null,
          base_id: null,
        },
      });

      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback(e);
      NcError.badRequest(e);
    }

    return true;
  }

  async integrationSoftDelete(
    context: Omit<NcContext, 'base_id'>,
    param: { integrationId: string },
  ) {
    try {
      const integration = await Integration.get(context, param.integrationId);
      await integration.softDelete();
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async integrationCreate(
    context: NcContext,
    param: {
      workspaceId: string;
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
    const workspace = await Workspace.get(param.workspaceId);

    param.logger?.('Creating the integration');

    let uniqueTitle = '';

    if (param.integration.copy_from_id) {
      const integrations =
        (
          await Integration.list({
            workspaceId: param.workspaceId,
            userId: param.req.user?.id,
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
      workspaceId: workspace.id,
      created_by: param.req.user.id,
    });

    await integration.authenticateOAuth();

    integration.config = undefined;

    this.appHooksService.emit(AppEvents.INTEGRATION_CREATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      context,
    });

    return integration;
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
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.SOURCES,
      {
        condition: {
          fk_workspace_id: integration.fk_workspace_id,
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

  async authIntegrationTestConnection(
    param: IntegrationReqType,
  ): Promise<TestConnectionResponse> {
    // Avoid testing connection for oauth integrations
    // We need to exchange the code to get the access token and here we can't store the access token
    if (param.config?.type === 'oauth') {
      return {
        success: true,
      };
    }

    const tempIntegrationWrapper =
      Integration.tempIntegrationWrapper<AuthIntegration>(param);

    return await tempIntegrationWrapper.testConnection();
  }
}
