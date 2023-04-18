import {
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { ExportImportService } from './../services/export-import.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class ExportImportController {
  constructor(private readonly exportImportService: ExportImportService) {}

  @Post('/api/v1/db/meta/export/:projectId/:baseId')
  @HttpCode(200)
  @Acl('exportBase')
  async exportBase(@Param('baseId') baseId: string, @Body() body: any) {
    return await this.exportImportService.exportBase({
      baseId,
      path: body.path,
    });
  }

  @Post('/api/v1/db/meta/import/:projectId/:baseId')
  @HttpCode(200)
  @Acl('importBase')
  async importBase(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Body() body: any,
  ) {
    return await this.exportImportService.importBase({
      user: (req as any).user,
      projectId: projectId,
      baseId: baseId,
      src: body.src,
      req,
    });
  }
}
