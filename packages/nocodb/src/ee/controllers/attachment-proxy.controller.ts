import path from 'path';
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { AttachmentsService } from '~/services/attachments.service';
import { PresignedUrl } from '~/models';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { isPreviewAllowed, localFileExists } from '~/helpers/attachmentHelpers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AttachmentProxyController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get('/api/v2/meta/bases/:baseId/docs/:docId/attachment')
  @Acl('documentGet')
  async serveDocAttachment(
    @TenantContext() _context: NcContext,
    @Param('docId') _docId: string,
    @Query('urlOrPath') urlOrPath: string,
    @Res() res: Response,
  ) {
    return this.serveAttachment(urlOrPath, res);
  }

  private async serveAttachment(urlOrPath: string, res: Response) {
    if (!urlOrPath) {
      return res.status(400).send('Missing urlOrPath parameter');
    }

    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const isExternalStorage =
      typeof (storageAdapter as any).getSignedUrl === 'function';

    if (isExternalStorage) {
      const isUrl = /^https?:\/\//i.test(urlOrPath);

      let pathOrUrl = urlOrPath;
      if (!isUrl) {
        // Convert local-style path (e.g. "download/noco/docs/file.png") to storage key
        const stripped = urlOrPath.replace(/^download\//, '');
        pathOrUrl = path.join('nc', 'uploads', stripped);
      }

      const signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl,
        preview: true,
      });

      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.redirect(302, signedUrl);
    }

    // Local storage: resolve and serve file directly
    const stripped = urlOrPath.replace(/^download\//, '');

    try {
      const file = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', stripped),
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
