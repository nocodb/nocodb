import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { SharedBasesService } from './shared-bases.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class SharedBasesController {
  constructor(private readonly sharedBasesService: SharedBasesService) {}

  @Post('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('createSharedBaseLink')
  async createSharedBaseLink(req, res): Promise<any> {
    const sharedBase = await this.sharedBasesService.createSharedBaseLink({
      projectId: req.params.projectId,
      roles: req.body?.roles,
      password: req.body?.password,
      siteUrl: req.ncSiteUrl,
    });

    res.json(sharedBase);
  }

  @Patch('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('updateSharedBaseLink')
  async updateSharedBaseLink(req, res): Promise<any> {
    const sharedBase = await this.sharedBasesService.updateSharedBaseLink({
      projectId: req.params.projectId,
      roles: req.body?.roles,
      password: req.body?.password,
      siteUrl: req.ncSiteUrl,
    });

    res.json(sharedBase);
  }

  @Delete('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('disableSharedBaseLink')
  async disableSharedBaseLink(req, res): Promise<any> {
    const sharedBase = await this.sharedBasesService.disableSharedBaseLink({
      projectId: req.params.projectId,
    });

    res.json(sharedBase);
  }

  @Get('/api/v1/db/meta/projects/:projectId/shared')
  @Acl('getSharedBaseLink')
  async getSharedBaseLink(req, res): Promise<any> {
    const sharedBase = await this.sharedBasesService.getSharedBaseLink({
      projectId: req.params.projectId,
      siteUrl: req.ncSiteUrl,
    });

    res.json(sharedBase);
  }
}
