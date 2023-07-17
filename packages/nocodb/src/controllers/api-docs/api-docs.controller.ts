import {
  Controller,
  Get,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '../../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ApiDocsService } from '../../services/api-docs/api-docs.service';
import getSwaggerHtml from './template/swaggerHtml';
import getRedocHtml from './template/redocHtml';

@Controller()
export class ApiDocsController {
  constructor(private readonly apiDocsService: ApiDocsService) {}

  @Get('/api/v1/db/meta/projects/:projectId/swagger.json')
  @UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
  @Acl('swaggerJson')
  async swaggerJson(@Param('projectId') projectId: string, @Request() req) {
    const swagger = await this.apiDocsService.swaggerJson({
      projectId: projectId,
      siteUrl: req.ncSiteUrl,
    });

    return swagger;
  }

  @Get('/api/v1/db/meta/projects/:projectId/swagger')
  swaggerHtml(@Param('projectId') projectId: string, @Response() res) {
    const ncPublicUrl = process.env.NC_PUBLIC_URL || '';
    const swaggerHtml = getSwaggerHtml({ ncSiteUrl : ncPublicUrl })
    res.send(swaggerHtml);
  }

  @Get('/api/v1/db/meta/projects/:projectId/redoc')
  redocHtml(@Param('projectId') projectId: string, @Response() res) {
    const ncPublicUrl = process.env.NC_PUBLIC_URL || '';
    const redocHtml = getRedocHtml({ ncSiteUrl : ncPublicUrl })
    res.send(redocHtml);
  }
}
