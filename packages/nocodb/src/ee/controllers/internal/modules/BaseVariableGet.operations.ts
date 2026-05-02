import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { BaseVariablesService } from '~/ee/services/base-variables.service';

@Injectable()
export class BaseVariableGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly baseVariablesService: BaseVariablesService) {}

  operations = ['baseVariableList' as const];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      operation,
      baseId,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload?: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'baseVariableList':
        return {
          list: await this.baseVariablesService.list(context, baseId),
        } as any;
    }
  }
}
