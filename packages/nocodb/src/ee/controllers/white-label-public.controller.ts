import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { localFileExists } from '~/helpers/attachmentHelpers';
import { WhiteLabelService } from '~/services/white-label.service';

/**
 * Public, unauthenticated branding-asset endpoint. A *stable* URL (embedded in
 * transactional emails and og tags) that always serves the **current** white-
 * label asset — or the NocoDB default when white-label is off / unset. Unlike
 * the signed `/dltemp` URL it never expires: on local storage the file is
 * streamed straight off disk (no cache, survives restarts); on cloud storage it
 * 302-redirects to a freshly-minted signed URL consumed immediately.
 *
 * Separate from `WhiteLabelController` because that one is super-admin + license
 * gated; this must stay open (same trust level as `appInfo`). Plan/enable gating
 * happens inside the service, which falls back to the NocoDB default rather than
 * erroring, so the URL is always safe to embed.
 */
@Controller()
@UseGuards(PublicApiLimiterGuard)
export class WhiteLabelPublicController {
  constructor(protected readonly whiteLabelService: WhiteLabelService) {}

  @Get('/api/v2/meta/white-label/asset/:type')
  async getAsset(@Param('type') type: string, @Res() res: Response) {
    try {
      const info = await this.whiteLabelService.getAssetServeInfo(type);

      // Stable endpoint; the `?v=` token in the embedded URL busts caches when
      // the asset changes, so a moderate browser/proxy cache is safe.
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (info.redirectUrl) {
        return res.redirect(302, info.redirectUrl);
      }

      if (!info.filePath || !(await localFileExists(info.filePath))) {
        return res.status(404).send('Not found');
      }

      if (info.contentType) {
        res.setHeader('Content-Type', info.contentType);
      }
      return res.sendFile(info.filePath);
    } catch (e) {
      return res.status(404).send('Not found');
    }
  }
}
