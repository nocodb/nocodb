import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MetaDiffsController {
  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/meta-diff',
    '/api/v2/meta/bases/:baseId/meta-diff',
  ])
  @Acl('metaDiff')
  async metaDiff(@Param('baseId') baseId: string) {
    return await this.metaDiffsService.metaDiff({ baseId });
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/meta-diff/:sourceId',
    '/api/v2/meta/bases/:baseId/meta-diff/:sourceId',
  ])
  @Acl('metaDiff')
  async baseMetaDiff(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return await this.metaDiffsService.baseMetaDiff({
      sourceId,
      baseId,
    });
  }
}
