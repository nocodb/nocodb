import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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

  @Post('/api/v1/db/meta/projects/:projectId/meta-diff')
  @HttpCode(200)
  @Acl('metaDiffSync')
  async metaDiffSync(@Param('projectId') projectId: string) {
    await this.metaDiffsService.metaDiffSync({ projectId });
    return { msg: 'The meta has been synchronized successfully' };
  }

  @Post('/api/v1/db/meta/projects/:projectId/meta-diff/:baseId')
  @HttpCode(200)
  @Acl('baseMetaDiffSync')
  async baseMetaDiffSync(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
  ) {
    await this.metaDiffsService.baseMetaDiffSync({
      projectId,
      baseId,
    });

    return { msg: 'The base meta has been synchronized successfully' };
  }
}
