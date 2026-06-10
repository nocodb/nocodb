import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { BaseTrashSettingsService } from '~/services/base-trash/base-trash-settings.service';
import { RecordTrashHandler } from '~/services/base-trash/handlers/record.trash-handler';

@Injectable()
export class BaseTrashPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    private readonly baseTrashService: BaseTrashService,
    private readonly baseTrashSettingsService: BaseTrashSettingsService,
    private readonly recordTrashHandler: RecordTrashHandler,
  ) {}

  operations = [
    'baseTrashRestore',
    'baseTrashRestoreRows',
    'baseTrashPermanentDelete',
    'baseTrashEmpty',
    'baseTrashSettingsUpdate',
  ] as (keyof typeof OPERATION_SCOPES)[];
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
      case 'baseTrashRestore':
        return await this.baseTrashService.restore(context, {
          trashId: payload.trashId,
          user: req.user,
          req,
          options: { force: payload.force, partial: payload.partial },
        });
      case 'baseTrashRestoreRows':
        return await this.recordTrashHandler.restoreRows(context, {
          tableId: payload.tableId,
          rowIds: payload.rowIds,
          req,
          force: payload.force,
          partial: payload.partial,
        });
      case 'baseTrashPermanentDelete':
        return await this.baseTrashService.permanentDelete(context, {
          trashId: payload.trashId,
          user: req.user,
          req,
        });
      case 'baseTrashEmpty':
        return await this.baseTrashService.emptyTrash(context, {
          baseId: context.base_id,
          user: req.user,
          req,
        });
      case 'baseTrashSettingsUpdate':
        return await this.baseTrashSettingsService.update(
          context,
          {
            tableId: payload.tableId,
            body: payload,
          },
          req,
        );
    }
  }
}
