import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { GlobalGuard } from '../guards/global/global.guard';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('/api/v1/notification')
  @Acl('notificationList')
  async notificationList(@Request() req) {
    return this.notificationsService.notificationList({
      user: req.user,
    });
  }

  // @Post('/api/v1/notification')
  // @Acl('notificationCreate')
  // async notificationCreate(@Request() req) {
  //   return this.notificationsService.notificationCreate();
  // }

  @Patch('/api/v1/notification/:notificationId')
  @Acl('notificationUpdate')
  async notificationUpdate(
    @Param('notificationId') notificationId,
    @Body() body,
    @Request() req,
  ) {
    return this.notificationsService.notificationUpdate({
      notificationId,
      body,
      user: req.user,
    });
  }

  @Delete('/api/v1/notification/:notificationId')
  @Acl('notificationDelete')
  async notificationDelete(
    @Param('notificationId') notificationId,
    @Request() req,
  ) {
    return this.notificationsService.notificationDelete({
      notificationId,
      user: req.user,
    });
  }
}
