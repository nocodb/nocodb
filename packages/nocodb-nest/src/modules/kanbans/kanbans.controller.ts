import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ViewCreateReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { KanbansService } from './kanbans.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
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
