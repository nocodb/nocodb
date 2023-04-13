import {
  Body,
  Controller,
  Get, HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ViewCreateReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../../guards/global/global.guard'
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { KanbansService } from './kanbans.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class KanbansController {
  constructor(private readonly kanbansService: KanbansService) {}

  @Get('/api/v1/db/meta/kanbans/:kanbanViewId')
  @Acl('kanbanViewGet')
  async kanbanViewGet(@Param('kanbanViewId') kanbanViewId: string) {
    return await this.kanbansService.kanbanViewGet({
      kanbanViewId,
    });
  }

  @Post('/api/v1/db/meta/tables/:tableId/kanbans')
  @HttpCode(200)
  @Acl('kanbanViewCreate')
  async kanbanViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
  ) {
    return await this.kanbansService.kanbanViewCreate({
      tableId,
      kanban: body,
    });
  }

  @Patch('/api/v1/db/meta/kanbans/:kanbanViewId')
  @Acl('kanbanViewUpdate')
  async kanbanViewUpdate(req, res) {
    res.json(
      await this.kanbansService.kanbanViewUpdate({
        kanbanViewId: req.params.kanbanViewId,
        kanban: req.body,
      }),
    );
  }
}
