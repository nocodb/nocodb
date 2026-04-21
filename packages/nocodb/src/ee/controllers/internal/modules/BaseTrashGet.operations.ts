import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';

@Injectable()
export class BaseTrashGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly baseTrashService: BaseTrashService) {}

  operations = ['baseTrashList'] as (keyof typeof OPERATION_SCOPES)[];
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
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'baseTrashList':
        return await this.baseTrashService.trashList(context, {
          baseId: context.base_id,
          resourceType: req.query.resourceType as string,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        });
    }
  }
}
