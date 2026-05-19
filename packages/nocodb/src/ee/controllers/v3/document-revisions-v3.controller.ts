import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type {
  DocumentRevisionV3ListResponseType,
  DocumentRevisionV3Type,
} from '~/services/v3/document-revisions-v3.types';
import type { DocumentV3Type } from '~/services/v3/documents-v3.types';
import { NcContext, NcRequest } from '~/interface/config';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DocumentRevisionsV3Service } from '~/services/v3/document-revisions-v3.service';
import { PREFIX_APIV3_DOCS } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { License } from '~/decorators/license.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License(PlanFeatureTypes.FEATURE_DOCS_APIS)
export class DocumentRevisionsV3Controller {
  constructor(
    private readonly documentRevisionsV3Service: DocumentRevisionsV3Service,
  ) {}

  @Get(`${PREFIX_APIV3_DOCS}/:docId/revisions`)
  @Acl('documentRevisionList', { scope: 'base' })
  async list(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<DocumentRevisionV3ListResponseType> {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOCS_APIS);

    return await this.documentRevisionsV3Service.list(context, {
      docId,
      limit: limit ? Number(limit) : undefined,
      before,
    });
  }

  @Get(`${PREFIX_APIV3_DOCS}/:docId/revisions/:revisionId`)
  @Acl('documentRevisionGet', { scope: 'base' })
  async get(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Param('revisionId') revisionId: string,
  ): Promise<DocumentRevisionV3Type> {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOCS_APIS);

    return await this.documentRevisionsV3Service.get(context, {
      docId,
      revisionId,
    });
  }

  @Post(`${PREFIX_APIV3_DOCS}/:docId/revisions/:revisionId/restore`)
  @HttpCode(200)
  @Acl('documentRevisionRestore', { scope: 'base' })
  async restore(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Param('revisionId') revisionId: string,
    @Request() req: NcRequest,
  ): Promise<DocumentV3Type> {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_DOCS_APIS);

    return await this.documentRevisionsV3Service.restore(
      context,
      { docId, revisionId },
      req,
    );
  }
}
