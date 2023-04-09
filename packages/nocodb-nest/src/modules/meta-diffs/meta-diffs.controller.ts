import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { MetaDiffsService } from './meta-diffs.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('meta-diffs')
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class MetaDiffsController {
  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  @Get('/api/v1/db/meta/projects/:projectId/meta-diff')
  @Acl('metaDiff')
  async metaDiff(@Param('projectId') projectId: string) {
    return await this.metaDiffsService.metaDiff({ projectId });
  }

  @Get('/api/v1/db/meta/projects/:projectId/meta-diff/:baseId')
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
  @Acl('metaDiffSync')
  async metaDiffSync(@Param('projectId') projectId: string) {
    await this.metaDiffsService.metaDiffSync({ projectId });
    return { msg: 'The meta has been synchronized successfully' };
  }

  @Post('/api/v1/db/meta/projects/:projectId/meta-diff/:baseId')
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
