import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { RecordTrashService } from '~/services/record-trash.service';

@Injectable()
export class TrashPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly recordTrashService: RecordTrashService) {}

  operations = [
    'recordTrashRestore' as const,
    'recordTrashPermanentDelete' as const,
    'recordTrashEmpty' as const,
    'recordTrashSettingsUpdate' as const,
  ];
  httpMethod = 'POST' as const;

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
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'recordTrashRestore':
        return await this.recordTrashService.restoreRecords(context, {
          tableId: req.body.tableId as string,
          rowIds: req.body.rowIds as string[],
          eventId: req.body.eventId as string,
          force: req.body.force as boolean,
          req,
        });
      case 'recordTrashPermanentDelete':
        return await this.recordTrashService.permanentDeleteRecords(context, {
          tableId: req.body.tableId as string,
          rowIds: req.body.rowIds as string[],
          eventId: req.body.eventId as string,
          req,
        });
      case 'recordTrashEmpty':
        return await this.recordTrashService.emptyTrash(context, {
          tableId: req.body.tableId as string,
          req,
        });
      case 'recordTrashSettingsUpdate':
        return await this.recordTrashService.updateTrashSettings(
          context,
          {
            tableId: req.body.tableId as string,
            body: req.body,
          },
          req,
        );
    }
  }
}
