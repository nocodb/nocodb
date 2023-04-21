import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post, Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { GlobalGuard } from '../guards/global/global.guard';
import {extractProps} from "../helpers/extractProps";

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('/api/v1/notification')
  @Acl('notificationList')
  async notificationList(@Request() req) {
    return this.notificationsService.notificationList({
      user: req.user,
      is_deleted: false,
      ...req.query,
    });
  }

  @Patch('/api/v1/notification/:notificationId')
  @Acl('notificationUpdate')
  async notificationUpdate(
    @Param('notificationId') notificationId,
    @Body() body,
    @Request() req,
  ) {
    return this.notificationsService.notificationUpdate({
      notificationId,
      body: extractProps(body, ['is_read']),
      user: req.user,
    });
  }

  @Delete('/api/v1/notification/:notificationId')
  @Acl('notificationDelete')
  async notificationDelete(
    @Param('notificationId') notificationId,
    @Request() req,
  ) {
    return this.notificationsService.notificationUpdate({
      notificationId,
      body: {
        is_deleted: true,
      },
      user: req.user,
    });
  }
}
