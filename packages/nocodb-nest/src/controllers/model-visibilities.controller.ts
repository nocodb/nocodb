import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { ModelVisibilitiesService } from '../services/model-visibilities.service';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class ModelVisibilitiesController {
  constructor(
    private readonly modelVisibilitiesService: ModelVisibilitiesService,
  ) {}

  @Post('/api/v1/db/meta/projects/:projectId/visibility-rules')
  @HttpCode(200)
  @Acl('modelVisibilitySet')
  async xcVisibilityMetaSetAll(
    @Param('projectId') projectId: string,
    @Body() body: any,
  ) {
    await this.modelVisibilitiesService.xcVisibilityMetaSetAll({
      visibilityRule: body,
      projectId,
    });

    return { msg: 'UI ACL has been created successfully' };
  }

  @Get('/api/v1/db/meta/projects/:projectId/visibility-rules')
  @Acl('modelVisibilityList')
  async modelVisibilityList(
    @Param('projectId') projectId: string,
    @Query('includeM2M') includeM2M: boolean | string,
  ) {
    return await this.modelVisibilitiesService.xcVisibilityMetaGet({
      projectId,
      includeM2M: includeM2M === true || includeM2M === 'true',
    });
  }
}
