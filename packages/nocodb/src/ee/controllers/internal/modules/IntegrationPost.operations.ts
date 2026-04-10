import { Injectable } from '@nestjs/common';
import { IntegrationPostOperations as IntegrationPostOperationsCE } from 'src/controllers/internal/modules/IntegrationPost.operations';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { IntegrationsService } from '~/services/integrations.service';
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import { BaseIntegrationsService } from '~/services/base-integrations.service';

@Injectable()
export class IntegrationPostOperations
  extends IntegrationPostOperationsCE
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly integrationsService: IntegrationsService,
    protected readonly syncService: SyncModuleService,
    protected readonly baseIntegrationsService: BaseIntegrationsService,
  ) {
    super(baseIntegrationsService);

    (this.operations as string[]) = [
      ...this.operations,
      'integrationFetchOptions',
      'baseIntegrationFetchOptions',
      'syncIntegrationFetchOptions',
      'authIntegrationTestConnection',
      'baseAuthIntegrationTestConnection',
      'integrationRemoteFetch',
    ];
  }

  async handle(
    context: NcContext,
    params: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    const { payload, operation } = params;

    switch (operation) {
      case 'integrationFetchOptions':
      case 'baseIntegrationFetchOptions':
        return await this.integrationsService.integrationFetchOptions(context, {
          integration: payload.integration,
          key: payload.key,
          params: payload.params,
        });
      case 'syncIntegrationFetchOptions':
        return await this.syncService.integrationFetchOptions(context, {
          integration: payload.integration,
          key: payload.key,
        });
      case 'authIntegrationTestConnection':
      case 'baseAuthIntegrationTestConnection':
        return await this.integrationsService.authIntegrationTestConnection(
          payload,
        );
      case 'integrationRemoteFetch':
        return await this.integrationsService.remoteFetch(context, payload);
      default:
        return super.handle(context, params);
    }
  }
}
