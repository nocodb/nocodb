import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../../guards/global/global.guard';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { BasesService } from './bases.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class BasesController {
  constructor(private readonly basesService: BasesService) {}

  @Get('/api/v1/db/meta/projects/:projectId/bases/:baseId')
  @Acl('baseGet')
  async baseGet(@Param('baseId') baseId: string) {
    const base = await this.basesService.baseGetWithConfig({
      baseId,
    });

    return base;
  }

  @Patch('/api/v1/db/meta/projects/:projectId/bases/:baseId')
  @Acl('baseUpdate')
  async baseUpdate(
    @Param('baseId') baseId: string,
    @Param('projectId') projectId: string,
    @Body() body: BaseReqType,
  ) {
    const base = await this.basesService.baseUpdate({
      baseId,
      base: body,
      projectId,
    });

    return base;
  }

  @Get('/api/v1/db/meta/projects/:projectId/bases')
  @Acl('baseList')
  async baseList(@Param('projectId') projectId: string) {
    const bases = await this.basesService.baseList({
      projectId,
    });

    return new PagedResponseImpl(bases, {
      count: bases.length,
      limit: bases.length,
    });
  }

  @Delete('/api/v1/db/meta/projects/:projectId/bases/:baseId')
  @Acl('baseDelete')
  async baseDelete(@Param('baseId') baseId: string) {
    const result = await this.basesService.baseDelete({
      baseId,
    });
    return result;
  }

  @Post('/api/v1/db/meta/projects/:projectId/bases')
  @HttpCode(200)
  @Acl('baseCreate')
  async baseCreate(
    @Param('projectId') projectId: string,
    @Body() body: BaseReqType,
  ) {
    const base = await this.basesService.baseCreate({
      projectId,
      base: body,
    });

    return base;
  }
}
