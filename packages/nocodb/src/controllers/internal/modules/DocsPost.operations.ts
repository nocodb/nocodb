import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { DocsService } from '~/services/docs.service';

@Injectable()
export class DocsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly docsService: DocsService) {}
  operations = [
    'docCreate' as const,
    'docUpdate' as const,
    'docDelete' as const,
    'docReorder' as const,
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
      case 'docCreate':
        return await this.docsService.create(context, payload, req);
      case 'docUpdate':
        return await this.docsService.update(
          context,
          payload.docId,
          payload,
          req,
        );
      case 'docDelete':
        return await this.docsService.delete(context, payload.docId);
      case 'docReorder':
        return await this.docsService.reorder(context, payload.docId, payload);
    }
  }
}
