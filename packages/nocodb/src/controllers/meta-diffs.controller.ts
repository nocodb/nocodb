import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class MetaDiffsController {
  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  @Get('/api/v1/db/meta/projects/:projectId/meta-diff')
  @Acl('metaDiff')
  async metaDiff(@Param('projectId') projectId: string) {
    return await this.metaDiffsService.metaDiff({ projectId });
  }

  @Get('/api/v1/db/meta/projects/:projectId/meta-diff/:baseId')
  @Acl('metaDiff')
  async baseMetaDiff(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
  ) {
    return await this.metaDiffsService.baseMetaDiff({
      baseId,
      projectId,
    });
  }
}
