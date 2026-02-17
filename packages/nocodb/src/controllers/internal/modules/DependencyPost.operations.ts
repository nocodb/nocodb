import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { DependencyService } from '~/services/dependency.service';

@Injectable()
export class DependencyPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly dependencyService: DependencyService) {}
  operations = ['checkDependency' as const];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
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
      case 'checkDependency':
        return await this.dependencyService.checkDependency(context, {
          entityType: payload.entityType,
          entityId: payload.entityId,
        });
    }
  }
}
