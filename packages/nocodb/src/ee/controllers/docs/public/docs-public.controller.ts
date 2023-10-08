import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PublicDocsService } from '../../../services/docs/public/public-docs.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';

@Controller()
@UseGuards(PublicApiLimiterGuard)
export class DocsPublicController {
  constructor(private readonly publicDocsService: PublicDocsService) {}

  @Get('/api/v1/public/docs/:baseId/pages/:id')
  async getPublicPageAndProject(
    @Param('baseId') baseId: string,
    @Param('id') id: string,
  ) {
    return await this.publicDocsService.getPublicPageAndProject({
      pageId: id,
      baseId,
    });
  }

  @Get('/api/v1/public/docs/:baseId/pages/:parentPageId/nested')
  async listPublicPages(
    @Param('baseId') baseId: string,
    @Param('parentPageId') parentPageId: string,
  ) {
    return await this.publicDocsService.listPublicPages({
      baseId,
      parentPageId,
    });
  }
}
