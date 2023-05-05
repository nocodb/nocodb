import {
  Body,
  Controller,
  Delete,
  Get,
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
import { SharedBasesService } from '../services/shared-bases.service';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class SharedBasesController {
  constructor(private readonly sharedBasesService: SharedBasesService) {}

  @Post('/api/v1/db/meta/projects/:projectId/shared')
  @HttpCode(200)
  @Acl('createSharedBaseLink')
  async createSharedBaseLink(
    @Request() req,
    @Body() body: any,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.createSharedBaseLink({
      projectId: projectId,
      roles: body?.roles,
      password: body?.password,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }

  @Patch('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('updateSharedBaseLink')
  async updateSharedBaseLink(
    @Request() req,
    @Body() body: any,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.updateSharedBaseLink({
      projectId: projectId,
      roles: body?.roles,
      password: body?.password,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }

  @Delete('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('disableSharedBaseLink')
  async disableSharedBaseLink(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.disableSharedBaseLink({
      projectId,
    });

    return sharedBase;
  }

  @Get('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('getSharedBaseLink')
  async getSharedBaseLink(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.getSharedBaseLink({
      projectId: projectId,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }
}
