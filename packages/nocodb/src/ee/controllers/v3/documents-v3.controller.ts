import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  DocumentCreateV3Type,
  DocumentReorderV3Type,
  DocumentUpdateV3Type,
  DocumentV3ListResponseType,
  DocumentV3Type,
} from '~/services/v3/documents-v3.types';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DocumentsV3Service } from '~/services/v3/documents-v3.service';
import { PREFIX_APIV3_DOCS } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DocumentsV3Controller {
  constructor(private readonly documentsV3Service: DocumentsV3Service) {}

  @Get(`${PREFIX_APIV3_DOCS}`)
  @Acl('documentList', { scope: 'base' })
  async docList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Query('parent_id') parentId?: string,
  ): Promise<DocumentV3ListResponseType> {
    // parent_id query: 'null' or omitted → root docs, otherwise children of that doc
    const resolvedParentId =
      parentId === undefined || parentId === 'null' ? null : parentId;
    return await this.documentsV3Service.docList(context, {
      baseId,
      parentId: resolvedParentId,
    });
  }

  @Post(`${PREFIX_APIV3_DOCS}`)
  @HttpCode(200)
  @Acl('documentCreate', { scope: 'base' })
  async docCreate(
    @TenantContext() context: NcContext,
    @Body() body: DocumentCreateV3Type,
    @Request() req: NcRequest,
  ): Promise<DocumentV3Type> {
    return await this.documentsV3Service.docCreate(context, body, req);
  }

  @Get(`${PREFIX_APIV3_DOCS}/:docId`)
  @Acl('documentGet', { scope: 'base' })
  async docGet(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
  ): Promise<DocumentV3Type> {
    return await this.documentsV3Service.docGet(context, { docId });
  }

  @Patch(`${PREFIX_APIV3_DOCS}/:docId`)
  @Acl('documentUpdate', { scope: 'base' })
  async docUpdate(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Body() body: DocumentUpdateV3Type,
    @Request() req: NcRequest,
  ): Promise<DocumentV3Type> {
    return await this.documentsV3Service.docUpdate(
      context,
      { docId },
      body,
      req,
    );
  }

  @Delete(`${PREFIX_APIV3_DOCS}/:docId`)
  @Acl('documentDelete', { scope: 'base' })
  async docDelete(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Request() req: NcRequest,
  ): Promise<boolean> {
    return await this.documentsV3Service.docDelete(context, { docId }, req);
  }

  @Patch(`${PREFIX_APIV3_DOCS}/:docId/reorder`)
  @Acl('documentReorder', { scope: 'base' })
  async docReorder(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Body() body: DocumentReorderV3Type,
    @Request() req: NcRequest,
  ): Promise<DocumentV3Type> {
    return await this.documentsV3Service.docReorder(
      context,
      { docId },
      body,
      req,
    );
  }
}
