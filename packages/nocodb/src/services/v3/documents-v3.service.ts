import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  DocumentCreateV3Type,
  DocumentReorderV3Type,
  DocumentUpdateV3Type,
  DocumentV3ListResponseType,
  DocumentV3Type,
} from '~/services/v3/documents-v3.types';
import {
  toDocumentV3,
  toDocumentV3ListItem,
} from '~/services/v3/documents-v3.types';
import { DocumentsService } from '~/services/documents.service';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class DocumentsV3Service {
  constructor(protected readonly documentsService: DocumentsService) {}

  async docList(
    context: NcContext,
    param: {
      baseId: string;
      parentId: string | null;
    },
  ): Promise<DocumentV3ListResponseType> {
    const docs = await this.documentsService.list(
      context,
      param.baseId,
      param.parentId,
    );
    return { list: docs.map(toDocumentV3ListItem) };
  }

  async docGet(
    context: NcContext,
    param: { docId: string },
  ): Promise<DocumentV3Type> {
    const doc = await this.documentsService.get(context, param.docId);
    return toDocumentV3(doc);
  }

  async docCreate(
    context: NcContext,
    body: DocumentCreateV3Type,
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    const doc = await this.documentsService.create(context, body, req);
    return toDocumentV3(doc);
  }

  async docUpdate(
    context: NcContext,
    param: { docId: string },
    body: DocumentUpdateV3Type,
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    const doc = await this.documentsService.update(
      context,
      param.docId,
      body,
      req,
    );
    return toDocumentV3(doc);
  }

  async docDelete(
    context: NcContext,
    param: { docId: string },
    req: NcRequest,
  ): Promise<boolean> {
    return await this.documentsService.delete(context, param.docId, req);
  }

  async docReorder(
    context: NcContext,
    param: { docId: string },
    body: DocumentReorderV3Type,
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    if (body.order == null && body.parent_id === undefined) {
      NcError.get(context).badRequest(
        'At least one of order or parent_id must be provided',
      );
    }

    const doc = await this.documentsService.reorder(
      context,
      param.docId,
      body,
      req,
    );
    return toDocumentV3(doc);
  }
}
