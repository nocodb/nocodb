/**
 * Internal API POST operations for AI Data.
 * Handles aiDataGenerateRows, aiDataFillRows, and aiDataExtractRows.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { AiDataService } from '~/integrations/ai/module/services/ai-data.service';

@Injectable()
export class AiDataPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly aiDataService: AiDataService) {}

  operations = [
    'aiDataGenerateRows' as const,
    'aiDataFillRows' as const,
    'aiDataExtractRows' as const,
  ];
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
      case 'aiDataGenerateRows': {
        if (!payload?.modelId) {
          NcError.badRequest('Missing required parameter: modelId');
        }
        return await this.aiDataService.generateRows(context, {
          modelId: payload.modelId,
          ...(typeof payload.column === 'string'
            ? { columnId: payload.column }
            : { aiPayload: payload.column }),
          rowIds: payload.rowIds,
          preview: payload.preview,
          req,
        });
      }
      case 'aiDataFillRows': {
        if (!payload?.modelId) {
          NcError.badRequest('Missing required parameter: modelId');
        }
        return await this.aiDataService.generateFillData(context, {
          modelId: payload.modelId,
          rows: payload.rows,
          generateIds: payload.generateIds,
          numRows: payload.numRows,
          req,
        });
      }
      case 'aiDataExtractRows': {
        if (!payload?.modelId) {
          NcError.badRequest('Missing required parameter: modelId');
        }
        return await this.aiDataService.extractRowsFromInput(context, {
          modelId: payload.modelId,
          input: payload.input,
          files: payload.files || [],
          req,
        });
      }
    }
  }
}
