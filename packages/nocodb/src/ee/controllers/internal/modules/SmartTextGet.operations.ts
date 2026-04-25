/**
 * Internal API GET operations for SmartText field type.
 * Handles smartTextGetContent — fetch PM JSON + markdown for a SmartText cell.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { SmartTextService } from '~/services/smart-text.service';

@Injectable()
export class SmartTextGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(protected readonly smartTextService: SmartTextService) {}
  operations = ['smartTextGetContent' as const];
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
      case 'smartTextGetContent': {
        const tableId = req.query.tableId as string;
        const rowId = req.query.rowId as string;
        const columnId = req.query.columnId as string;
        if (!tableId || !rowId || !columnId) {
          NcError.badRequest(
            'Missing required parameters: tableId, rowId, columnId',
          );
        }
        return await this.smartTextService.getContent(context, {
          tableId,
          rowId,
          columnId,
        });
      }
    }
  }
}
