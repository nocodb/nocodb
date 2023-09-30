import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';

@Controller()
@UseGuards(GlobalGuard)
export class BasesController {
  constructor(private readonly basesService: BasesService) {}

  @Get('/api/v1/db/meta/projects/:projectId/bases/:baseId')
  @Acl('baseGet')
  async baseGet(@Param('baseId') baseId: string) {
    const base = await this.basesService.baseGetWithConfig({
      baseId,
    });

    if (base.isMeta()) {
      delete base.config;
    }

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

    for (const base of bases) {
      if (base.isMeta()) {
        delete base.config;
      }
    }

    return new PagedResponseImpl(bases, {
      count: bases.length,
      limit: bases.length,
    });
  }
}
