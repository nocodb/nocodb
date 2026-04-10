import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { BaseIntegrationsService } from '~/services/base-integrations.service';

@Injectable()
export class IntegrationGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    protected readonly baseIntegrationsService: BaseIntegrationsService,
  ) {}
  operations = [
    'baseIntegrationList' as const,
    'baseIntegrationRead' as const,
    'integrationLinkedBaseList' as const,
  ];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'baseIntegrationList':
        return await this.baseIntegrationsService.listForBase(context, {
          baseId: context.base_id,
          type: req.query.type as any,
          subType: req.query.subType as string,
          userId: req.user?.id,
        });
      case 'baseIntegrationRead':
        return await this.baseIntegrationsService.readFromBase(context, {
          baseId: context.base_id,
          integrationId: req.query.integrationId as string,
          userId: req.user?.id,
          includeConfig: req.query.includeConfig === 'true',
        });
      case 'integrationLinkedBaseList':
        return (await this.baseIntegrationsService.linkedBaseList(context, {
          integrationId: req.query.integrationId as string,
        })) as any;
    }
  }
}
