import { Injectable } from '@nestjs/common';
import type { IntegrationReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Integration } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Workspace } from '~/ee/models';

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

  async integrationList(param: { workspaceId: string }) {
    const integrations = await Integration.list({
      workspaceId: param.workspaceId,
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

    // type | workspace | integrationId
    const integrationBody = param.integration;
    const workspace = await Workspace.get(param.workspaceId);

    param.logger?.('Creating the integration');

    const integration = await Integration.createIntegration({
      ...integrationBody,
      type: integrationBody.config?.client,
      workspaceId: workspace.id,
    });

    delete integration.config;

    //  todo: map events
    // this.appHooksService.emit(AppEvents.BASE_CREATE, {
    //   integration,
    //   req: param.req,
    // });

    return integration;
  }
}
