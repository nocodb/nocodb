import path from 'path';
import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { PublicDocsService } from '~/ee/services/public-docs.service';
import { AttachmentsService } from '~/services/attachments.service';
import { PresignedUrl } from '~/models';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { isPreviewAllowed, localFileExists } from '~/helpers/attachmentHelpers';
import { NcContext } from '~/interface/config';

/**
 * Public reader endpoints for shared docs. Mirrors PublicMetasController for
 * views — UUID is the bearer credential. Docs do not support password
 * protection.
 *
 * The `X-Robots-Tag: noindex, nofollow` header on every response is the
 * Phase-1 indexing posture. Phase 2 will introduce a toggle and the header
 * will become conditional.
 */
@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDocsController {
  constructor(
    protected readonly publicDocsService: PublicDocsService,
    protected readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * Reject paths that escape the expected base directory via traversal segments.
   * Mirrors AttachmentProxyController.sanitizeStoragePath — path.join normalises
   * ".." but does NOT prevent escape, so we must verify the resolved path
   * still starts with the expected prefix.
   */
  private sanitizeStoragePath(joined: string): string {
    const resolved = path.resolve(joined);
    const base = path.resolve('nc', 'uploads');
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error('Invalid attachment path');
    }
    return joined;
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/meta')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async docMetaGet(
    @TenantContext() context: NcContext,
    @Param('sharedDocUuid') sharedDocUuid: string,
  ) {
    return await this.publicDocsService.docMetaGet(context, { sharedDocUuid });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/content')
  @Header('X-Robots-Tag', 'noindex, nofollow')
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
   * Lazy children fetch — returns the direct children of `parentDocId`
   * inside the share. The reader sidebar calls this when the user expands
   * a node, mirroring the in-app `documentList(parent_id=docId)` pattern.
   */
  @Get('/api/v2/public/shared-doc/:sharedDocUuid/children/:parentDocId')
  @Header('X-Robots-Tag', 'noindex, nofollow')
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
   * Stream the file or redirect to a signed URL on external storage. Mirrors
   * AttachmentProxyController.serveAttachment — same storage abstraction, but
   * we keep a local copy to avoid coupling the public controller to the
   * authed one (different guards, different scope).
   */
  private async serveAttachment(fileUrl: string, res: Response) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const isExternalStorage =
      typeof (storageAdapter as any).getSignedUrl === 'function';

    if (isExternalStorage) {
      const isUrl = /^https?:\/\//i.test(fileUrl);

      let pathOrUrl = fileUrl;
      if (!isUrl) {
        const stripped = fileUrl.replace(/^download\//, '');
        pathOrUrl = this.sanitizeStoragePath(
          path.join('nc', 'uploads', stripped),
        );
      }

      const signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl,
        preview: true,
      });

      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.redirect(302, signedUrl);
    }

    const stripped = fileUrl.replace(/^download\//, '');

    try {
      const file = await this.attachmentsService.getFile({
        path: this.sanitizeStoragePath(path.join('nc', 'uploads', stripped)),
      });

      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      // 5 minutes — short enough that revoking the share takes effect
      // quickly, long enough to soak up the burst of <img> requests a single
      // page render fires. Aligned with the external-storage redirect path
      // above so both backends behave the same after unshare.
      res.setHeader('Cache-Control', 'public, max-age=300');

      if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
        res.sendFile(file.path);
      } else {
        res.download(file.path);
      }
    } catch {
      res.status(404).send('Not found');
    }
  }
}
