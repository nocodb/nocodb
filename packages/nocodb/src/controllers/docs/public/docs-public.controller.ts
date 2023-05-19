import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { PublicDocsService } from '../../../services/docs/public/public-docs.service';

@Controller()
export class DocsPublicController {
  constructor(private readonly publicDocsService: PublicDocsService) {}

  @Get('/api/v1/public/docs/project/:projectId/page/:id')
  async getPublicPageAndProject(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return await this.publicDocsService.getPublicPageAndProject({
      pageId: id,
      projectId,
    });
  }

  @Get('/api/v1/public/docs/project/:projectId/pages/:parentPageId')
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
