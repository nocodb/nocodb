/**
 * Internal API POST operations for SmartText field type.
 * Handles smartTextUpdateContent — write PM JSON + derived markdown for a cell.
 */
import { Injectable } from '@nestjs/common';
import { SMART_TEXT_MAX_BYTES } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { SmartTextService } from '~/services/smart-text.service';

@Injectable()
export class SmartTextPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly smartTextService: SmartTextService) {}
  operations = ['smartTextUpdateContent' as const];
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
      case 'smartTextUpdateContent': {
        // Early Content-Length cap — global JSON body limit is 50MB, but the
        // SmartText cell limit is 5MB. Reject oversized payloads at the route
        // boundary before serializing/processing the parsed body downstream.
        const contentLengthHeader = req.headers?.['content-length'];
        const contentLength = contentLengthHeader
          ? Number(contentLengthHeader)
          : NaN;
        if (
          Number.isFinite(contentLength) &&
          contentLength > SMART_TEXT_MAX_BYTES
        ) {
          NcError.badRequest(
            `SmartText content exceeds ${SMART_TEXT_MAX_BYTES} bytes (got ${contentLength})`,
          );
        }

        const tableId = req.query.tableId as string;
        const rowId = req.query.rowId as string;
        const columnId = req.query.columnId as string;
        if (!tableId || !rowId || !columnId) {
          NcError.badRequest(
            'Missing required parameters: tableId, rowId, columnId',
          );
        }
        if (!payload?.pmContent) {
          NcError.badRequest('Missing required body field: pmContent');
        }
        return await this.smartTextService.updateContent(context, {
          tableId,
          rowId,
          columnId,
          pmContent: payload.pmContent,
          req,
        });
      }
    }
  }
}
