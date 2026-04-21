import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { BaseVariablesService } from '~/ee/services/base-variables.service';

@Injectable()
export class BaseVariablePostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly baseVariablesService: BaseVariablesService) {}

  operations = [
    'baseVariableCreate' as const,
    'baseVariableUpdate' as const,
    'baseVariableDelete' as const,
    'baseVariableBulkUpdate' as const,
    'baseVariableRevertToDefault' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
      payload,
      baseId,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload?: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'baseVariableCreate':
        return await this.baseVariablesService.create(
          context,
          baseId,
          payload,
          req,
        );

      case 'baseVariableUpdate':
        return await this.baseVariablesService.update(
          context,
          req.query.variableId as string,
          payload,
          req,
        );

      case 'baseVariableDelete':
        return await this.baseVariablesService.delete(
          context,
          req.query.variableId as string,
          req,
        );

      case 'baseVariableBulkUpdate':
        return await this.baseVariablesService.bulkUpdate(
          context,
          baseId,
          payload?.variables,
          req,
        );

      case 'baseVariableRevertToDefault':
        return await this.baseVariablesService.revertToDefault(
          context,
          req.query.variableId as string,
          req,
        );
    }
  }
}
