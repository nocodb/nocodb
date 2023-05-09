import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { KanbansService } from '../services/kanbans.service';

@Controller()
@UseGuards(GlobalGuard)
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
    @Req() req: any,
  ) {
    return await this.kanbansService.kanbanViewCreate({
      tableId,
      kanban: body,
      user: req.user,
    });
  }

  @Patch('/api/v1/db/meta/kanbans/:kanbanViewId')
  @Acl('kanbanViewUpdate')
  async kanbanViewUpdate(
    @Param('kanbanViewId') kanbanViewId: string,
    @Body() body,
  ) {
    return await this.kanbansService.kanbanViewUpdate({
      kanbanViewId,
      kanban: body,
    });
  }
}
