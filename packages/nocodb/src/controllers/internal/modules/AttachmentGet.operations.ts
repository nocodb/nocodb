import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { AttachmentsService } from '~/services/attachments.service';
import { DataTableService } from '~/services/data-table.service';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class AttachmentGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    protected readonly attachmentsService: AttachmentsService,
    protected readonly dataTableService: DataTableService,
  ) {}

  operations = ['attachmentDownload' as const];
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
      case 'attachmentDownload':
        return await this.downloadAttachment(context, req);
    }
  }

  protected async downloadAttachment(context: NcContext, req: NcRequest) {
    const modelId = req.query.modelId as string;
    const columnId = req.query.columnId as string;
    const rowId = req.query.rowId as string;
    const urlOrPath = req.query.urlOrPath as string;

    const column = await Column.get(context, {
      colId: columnId,
    });

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    const record = await this.dataTableService.dataRead(context, {
      baseId: context.base_id,
      modelId,
      rowId,
      query: {
        fields: column.title,
      },
    });

    if (!record) {
      NcError.recordNotFound(rowId);
    }

    return this.attachmentsService.getAttachmentFromRecord({
      record,
      column,
      urlOrPath,
    });
  }
}
