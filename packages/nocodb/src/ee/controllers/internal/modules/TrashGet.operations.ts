import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { RecordTrashService } from '~/services/record-trash.service';

@Injectable()
export class TrashGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly recordTrashService: RecordTrashService) {}

  operations = [
    'recordTrashEvents' as const,
    'recordTrashCount' as const,
    'recordTrashSettingsList' as const,
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
      payload?: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'recordTrashEvents':
        return await this.recordTrashService.listTrashEvents(context, {
          tableId: req.query.tableId as string,
          limit: req.query.limit ? +req.query.limit : undefined,
          cursor: req.query.cursor
            ? (req.query.cursor as string)
            : undefined,
        });
      case 'recordTrashCount':
        return await this.recordTrashService.getTrashCount(context, {
          tableId: req.query.tableId as string,
        });
      case 'recordTrashSettingsList':
        return await this.recordTrashService.getBaseTrashSettings(context, {
          baseId: context.base_id,
          user: req.user,
          roles: req.user?.base_roles ?? {},
        });
    }
  }
}
