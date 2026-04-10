import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { BaseIntegrationsService } from '~/services/base-integrations.service';

@Injectable()
export class IntegrationPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly baseIntegrationsService: BaseIntegrationsService,
  ) {}
  operations = [
    'baseIntegrationCreate' as const,
    'baseIntegrationUpdate' as const,
    'baseIntegrationLink' as const,
    'baseIntegrationUnlink' as const,
    'integrationUpdateLinkedBases' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      operation,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'baseIntegrationCreate':
        return await this.baseIntegrationsService.createFromBase(context, {
          baseId: context.base_id,
          integration: payload,
          req,
        });
      case 'baseIntegrationUpdate':
        return await this.baseIntegrationsService.updateFromBase(context, {
          baseId: context.base_id,
          integrationId: req.query.integrationId as string,
          integration: payload,
          req,
        });
      case 'baseIntegrationLink':
        return (await this.baseIntegrationsService.link(context, {
          baseId: context.base_id,
          integrationId: req.query.integrationId as string,
          userId: req.user?.id,
        })) as any;
      case 'baseIntegrationUnlink':
        return (await this.baseIntegrationsService.unlink(context, {
          baseId: context.base_id,
          integrationId: req.query.integrationId as string,
        })) as any;
      case 'integrationUpdateLinkedBases':
        return (await this.baseIntegrationsService.updateLinkedBases(context, {
          integrationId: req.query.integrationId as string,
          allBases: payload.all_bases,
          baseIds: payload.base_ids,
          userId: req.user?.id,
        })) as any;
    }
  }
}
