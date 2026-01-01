import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { IntegrationsService } from '~/services/integrations.service';

@Injectable()
export class IntegrationPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly integrationsService: IntegrationsService) {}
  operations = ['integrationFetchOptions' as const];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'integrationFetchOptions':
        return await this.integrationsService.integrationFetchOptions(context, {
          integration: payload.integration,
          key: payload.key,
          params: payload.params,
        });
    }
  }
}
