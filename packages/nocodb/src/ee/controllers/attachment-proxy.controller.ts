import path from 'path';
import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { AttachmentsService } from '~/services/attachments.service';
import { FileReference, PresignedUrl } from '~/models';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { isPreviewAllowed, localFileExists } from '~/helpers/attachmentHelpers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AttachmentProxyController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Reject paths that escape the expected base directory via traversal segments.
   * path.join normalises ".." but does NOT prevent escaping — we must verify the
   * resolved path still starts with the expected prefix.
   */
  private sanitizeStoragePath(joined: string): string {
    const resolved = path.resolve(joined);
    const base = path.resolve('nc', 'uploads');
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error('Invalid attachment path');
    }
    return joined;
  }

  @Get('/api/v2/data/bases/:baseId/docs/:docId/attachment/:fileId')
  @Acl('documentGet')
  async serveDocAttachment(
    @TenantContext() context: NcContext,
    @Param('docId') docId: string,
    @Param('fileId') fileRefId: string,
    @Res() res: Response,
  ) {
    const fileRef = await FileReference.get(context, fileRefId);

    if (!fileRef || fileRef.deleted || fileRef.fk_doc_id !== docId) {
      return res.status(404).send('Attachment not found');
    }

    return this.serveAttachment(fileRef.file_url, res);
  }

  private async serveAttachment(fileUrl: string, res: Response) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const isExternalStorage =
      typeof (storageAdapter as any).getSignedUrl === 'function';

    if (isExternalStorage) {
      const isUrl = /^https?:\/\//i.test(fileUrl);

      let pathOrUrl = fileUrl;
      if (!isUrl) {
        // Convert local-style path (e.g. "download/noco/docs/file.png") to storage key
        const stripped = fileUrl.replace(/^download\//, '');
        pathOrUrl = this.sanitizeStoragePath(
          path.join('nc', 'uploads', stripped),
        );
      }

      const signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl,
        preview: true,
      });

      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.redirect(302, signedUrl);
    }

    // Local storage: resolve and serve file directly
    const stripped = fileUrl.replace(/^download\//, '');

    try {
      const file = await this.attachmentsService.getFile({
        path: this.sanitizeStoragePath(path.join('nc', 'uploads', stripped)),
      });

      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      res.setHeader('Cache-Control', 'private, max-age=86400, immutable');

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
