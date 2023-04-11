import { Controller, Get, Request, Param, Query } from '@nestjs/common';
import { PublicDocsService } from './public-docs.service';

@Controller()
export class PublicDocsController {
  constructor(private readonly publicDocsService: PublicDocsService) {}

  @Get('/api/v1/public/docs/page/:id')
  async getPublicPageAndProject(
    @Query('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return await this.publicDocsService.getPublicPageAndProject({
      pageId: id,
      projectId,
    });
  }

  @Get('/api/v1/public/docs/pages')
  async listPublicPages(
    @Query('projectId') projectId: string,
    @Query('parent_page_id') parentPageId: string,
  ) {
    return await this.publicDocsService.listPublicPages({
      projectId,
      parentPageId,
    });
  }
}
