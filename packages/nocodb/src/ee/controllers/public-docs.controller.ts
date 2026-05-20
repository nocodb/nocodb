import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { PublicDocsService } from '~/ee/services/public-docs.service';
import { AttachmentsService } from '~/services/attachments.service';
import { serveStoredAttachment } from '~/helpers/attachmentHelpers';
import { NcContext } from '~/interface/config';

// Matched to the browser Cache-Control window — caps how long a revoked
// share can still resolve files directly from storage.
const PUBLIC_SHARED_SIGNED_URL_TTL_SECONDS = 5 * 60;

// CDN-absorbable cache for the JSON read endpoints. A viral share at 10k
// rps lands on the origin only on cold/SWR refreshes (~10-100 rps),
// keeping the meta DB out of the hot path. Trade-off: a revoked share
// can resolve for up to max-age + stale-while-revalidate = 70s. Tighten
// if instant revocation is required.
const PUBLIC_DOC_JSON_CACHE_CONTROL =
  'public, max-age=10, stale-while-revalidate=60';

// Production deployments should set NC_SECURE_ATTACHMENTS=true so the
// unauthenticated /download route is replaced by /dltemp (signed-only),
// forcing all access through this UUID-gated proxy.
@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDocsController {
  constructor(
    protected readonly publicDocsService: PublicDocsService,
    protected readonly attachmentsService: AttachmentsService,
  ) {}

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/meta')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', PUBLIC_DOC_JSON_CACHE_CONTROL)
  async docMetaGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
  ) {
    return await this.publicDocsService.docMetaGet(context, { sharedDocUuid });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/content')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', PUBLIC_DOC_JSON_CACHE_CONTROL)
  async docContentGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
    @Param('docId') docId: string,
  ) {
    return await this.publicDocsService.docContentGet(context, {
      sharedDocUuid,
      docId,
    });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/lite')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', PUBLIC_DOC_JSON_CACHE_CONTROL)
  async docLiteGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
    @Param('docId') docId: string,
  ) {
    return await this.publicDocsService.docLiteGet(context, {
      sharedDocUuid,
      docId,
    });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/children/:parentDocId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', PUBLIC_DOC_JSON_CACHE_CONTROL)
  async docChildrenGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
    @Param('parentDocId') parentDocId: string,
  ) {
    return await this.publicDocsService.docChildrenGet(context, {
      sharedDocUuid,
      parentDocId,
    });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/attachment/:fileId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async docAttachmentGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
    @Param('docId') docId: string,
    @Param('fileId') fileRefId: string,
    @Res() res: Response,
  ) {
    const { fileUrl } = await this.publicDocsService.docAttachmentGet(context, {
      sharedDocUuid,
      docId,
      fileRefId,
    });

    return this.serveAttachment(fileUrl, res);
  }

  // 5 min Cache-Control absorbs the burst of <img> requests on doc render
  // while keeping the post-revocation window tight. Signed-URL TTL matches.
  private serveAttachment(fileUrl: string, res: Response) {
    return serveStoredAttachment(res, fileUrl, {
      attachmentsService: this.attachmentsService,
      signedUrlTtlSeconds: PUBLIC_SHARED_SIGNED_URL_TTL_SECONDS,
      cacheControl: 'private, max-age=300, must-revalidate',
    });
  }
}
