import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { PublicDocsService } from '~/ee/services/public-docs.service';
import { AttachmentsService } from '~/services/attachments.service';
import { serveStoredAttachment } from '~/helpers/attachmentHelpers';
import { NcContext } from '~/interface/config';

/**
 * Lifetime of an external-storage signed URL handed to anonymous public-share
 * viewers. Matched to the browser Cache-Control window so a revoked share
 * can no longer resolve files on the storage backend after the window
 * elapses.
 */
const PUBLIC_SHARED_SIGNED_URL_TTL_SECONDS = 5 * 60;

/**
 * Public reader endpoints for shared docs. Mirrors PublicMetasController for
 * views — UUID is the bearer credential. Docs do not support password
 * protection.
 *
 * The `X-Robots-Tag: noindex, nofollow` header on every response is the
 * Phase-1 indexing posture. Phase 2 will introduce a toggle and the header
 * will become conditional.
 *
 * Production note: deployments should set `NC_SECURE_ATTACHMENTS=true`. In
 * secure mode the global unauthenticated `/download/:filename(*)` route is
 * not registered (replaced by `/dltemp/:param(*)` which only resolves
 * server-issued signed paths), so embedded `attrs.path` values surfaced via
 * the public content response are inert and access goes exclusively through
 * this controller's UUID-gated, scope-checked proxy.
 */
@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDocsController {
  constructor(
    protected readonly publicDocsService: PublicDocsService,
    protected readonly attachmentsService: AttachmentsService,
  ) {}

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/meta')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'private, no-store')
  async docMetaGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
  ) {
    return await this.publicDocsService.docMetaGet(context, { sharedDocUuid });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/content')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'private, no-store')
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

  /**
   * Lite ancestor lookup. Returns sidebar-shape metadata (no content blob)
   * for one doc inside the share — used by the deep-link walker to render
   * intermediate breadcrumbs without firing /content for each ancestor.
   */
  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/lite')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'private, no-store')
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

  /**
   * Lazy children fetch — returns the direct children of `parentDocId`
   * inside the share. The reader sidebar calls this when the user expands
   * a node, mirroring the in-app `documentList(parent_id=docId)` pattern.
   */
  @Get('/api/v2/public/shared-doc/:sharedDocUuid/children/:parentDocId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Cache-Control', 'private, no-store')
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

  /**
   * Public-share attachment proxy. Anonymous: gated by the UUID. Streams
   * local files or redirects to a signed URL on external storage.
   */
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

  /**
   * Stream the file or redirect to a signed URL on external storage. Shares
   * `serveStoredAttachment` with the authed proxy — same storage
   * abstraction, different guard + cache policy.
   *
   * Cache policy `private, max-age=300, must-revalidate`:
   *   - `private` blocks shared caches (CDN, corporate proxy) from storing
   *     responses keyed by the share URL.
   *   - `max-age=300` absorbs the burst of <img> requests a doc render
   *     fires without re-hitting the proxy.
   *   - `must-revalidate` propagates revocation through the browser cache
   *     within 5 minutes after the share is disabled.
   *
   * Signed-URL TTL matches the cache window (5 min): once a signed URL
   * leaves the proxy it can't be recalled, so the URL TTL caps the
   * post-revocation window during which a viewer can still resolve the
   * file directly from storage.
   */
  private serveAttachment(fileUrl: string, res: Response) {
    return serveStoredAttachment(res, fileUrl, {
      attachmentsService: this.attachmentsService,
      signedUrlTtlSeconds: PUBLIC_SHARED_SIGNED_URL_TTL_SECONDS,
      cacheControl: 'private, max-age=300, must-revalidate',
    });
  }
}
