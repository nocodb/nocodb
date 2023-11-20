import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ModelVisibilitiesService } from '~/services/model-visibilities.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ModelVisibilitiesController {
  constructor(
    private readonly modelVisibilitiesService: ModelVisibilitiesService,
  ) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/visibility-rules',
    '/api/v2/meta/bases/:baseId/visibility-rules',
  ])
  @HttpCode(200)
  @Acl('modelVisibilitySet')
  async xcVisibilityMetaSetAll(
    @Param('baseId') baseId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    await this.modelVisibilitiesService.xcVisibilityMetaSetAll({
      visibilityRule: body,
      baseId,
      req,
    });

    return { msg: 'UI ACL has been created successfully' };
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/visibility-rules',
    '/api/v2/meta/bases/:baseId/visibility-rules',
  ])
  @Acl('modelVisibilityList')
  async modelVisibilityList(
    @Param('baseId') baseId: string,
    @Query('includeM2M') includeM2M: boolean | string,
  ) {
    return await this.modelVisibilitiesService.xcVisibilityMetaGet({
      baseId,
      includeM2M: includeM2M === true || includeM2M === 'true',
    });
  }
}
