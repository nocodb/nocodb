import { Injectable } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { IntegrationReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Integration } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Source, Workspace } from '~/models';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class IntegrationsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async integrationGetWithConfig(
    context: NcContext,
    param: { integrationId: any },
  ) {
    const integration = await Integration.get(param.integrationId);

    integration.config = await integration.getConnectionConfig();

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

    const integrationBody = param.integration;
    const integration = await Integration.updateIntegration(
      context,
      param.integrationId,
      {
        ...integrationBody,
        type: integrationBody.config?.client,
        id: param.integrationId,
      },
    );

    delete integration.config;

    // todo: add new event type
    // this.appHooksService.emit(AppEvents.BASE_UPDATE, {
    //   integration,
    //   req: param.req,
    // });

    return integration;
  }

  async integrationList(param: { workspaceId: string; req: NcRequest }) {
    const haveWorkspaceLevelPermission = Object.keys(
      param.req.user.workspace_roles,
    ).some(
      (role) =>
        param.req.user.workspace_roles[role] &&
        [WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(
          role as WorkspaceUserRoles,
        ),
    );

    const integrations = await Integration.list({
      workspaceId: param.workspaceId,
      haveWorkspaceLevelPermission,
      userId: param.req.user?.id,
    });

    return integrations;
  }

  async integrationDelete(param: { integrationId: string; req: any }) {
    try {
      const integration = await Integration.get(param.integrationId, true);
      await integration.delete();
      // todo: add new event type
      // this.appHooksService.emit(AppEvents.BASE_DELETE, {
      //   integration,
      //   req: param.req,
      // });
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async integrationSoftDelete(param: { integrationId: string }) {
    try {
      const integration = await Integration.get(param.integrationId);
      await integration.softDelete();
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async integrationCreate(param: {
    workspaceId: string;
    integration: IntegrationReqType;
    logger?: (message: string) => void;
    req: any;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/IntegrationReq',
      param.integration,
    );

    const integrationBody = param.integration;
    const workspace = await Workspace.get(param.workspaceId);

    param.logger?.('Creating the integration');

    const integration = await Integration.createIntegration({
      ...integrationBody,
      type: integrationBody.config?.client,
      workspaceId: workspace.id,
    });

    // update the cache for the sources which are using this integration
    await this.updateIntegrationSourceConfig({ integration });

    delete integration.config;

    return integration;
  }

  // function to update all the integration source config which are using this integration
  // we are overwriting the source config with the new integration config excluding database name and schema name
  private async updateIntegrationSourceConfig(
    {
      integration,
    }: {
      integration: Integration;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // get all the bases which are using this integration
    const sources = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BASES,
      {
        condition: {
          fk_workspace_id: integration.fk_workspace_id,
          integrationId: integration.id,
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
      await NocoCache.update(`${CacheScope.BASE}:${source.id}`, {
        integration_config: integration.config,
      });
    }
  }
}
