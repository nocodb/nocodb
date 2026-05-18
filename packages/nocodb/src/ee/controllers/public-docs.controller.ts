import {
  Controller,
  Get,
  Header,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { PublicDocsService } from '~/ee/services/public-docs.service';
import { NcContext, NcRequest } from '~/interface/config';

/**
 * Public reader endpoints for shared docs. Mirrors PublicMetasController for
 * views — UUID is the bearer credential, optional xc-password header gates
 * password-protected shares.
 *
 * The `X-Robots-Tag: noindex, nofollow` header on every response is the
 * Phase-1 indexing posture. Phase 2 will introduce a toggle and the header
 * will become conditional.
 */
@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDocsController {
  constructor(protected readonly publicDocsService: PublicDocsService) {}

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/meta')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async docMetaGet(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedDocUuid') sharedDocUuid: string,
  ) {
    return await this.publicDocsService.docMetaGet(context, {
      password: (req.headers?.['xc-password'] as string) ?? '',
      sharedDocUuid,
    });
  }

  @Get('/api/v2/public/shared-doc/:sharedDocUuid/doc/:docId/content')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async docContentGet(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedDocUuid') sharedDocUuid: string,
    @Param('docId') docId: string,
  ) {
    return await this.publicDocsService.docContentGet(context, {
      password: (req.headers?.['xc-password'] as string) ?? '',
      sharedDocUuid,
      docId,
    });
  }
}
