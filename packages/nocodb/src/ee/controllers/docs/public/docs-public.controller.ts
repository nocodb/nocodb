import { Controller, Get, Param } from '@nestjs/common';
import { PublicDocsService } from '../../../services/docs/public/public-docs.service';

@Controller()
export class DocsPublicController {
  constructor(private readonly publicDocsService: PublicDocsService) {}

  @Get('/api/v1/public/docs/:projectId/pages/:id')
  async getPublicPageAndProject(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return await this.publicDocsService.getPublicPageAndProject({
      pageId: id,
      projectId,
    });
  }

  @Get('/api/v1/public/docs/:projectId/pages/:parentPageId/nested')
  async listPublicPages(
    @Param('projectId') projectId: string,
    @Param('parentPageId') parentPageId: string,
  ) {
    return await this.publicDocsService.listPublicPages({
      projectId,
      parentPageId,
    });
  }
}
