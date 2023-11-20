import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from '~/services/notifications.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { extractProps } from '~/helpers/extractProps';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('/api/v1/notifications')
  // @Acl('notificationList')
  async notificationList(@Req() req: Request) {
    return this.notificationsService.notificationList({
      user: req.user,
      is_deleted: false,
      ...req.query,
      is_read: req.query.is_read === 'true',
    });
  }

  @Patch('/api/v1/notifications/:notificationId')
  // @Acl('notificationUpdate')
  async notificationUpdate(
    @Param('notificationId') notificationId,
    @Body() body,
    @Req() req: Request,
  ) {
    return this.notificationsService.notificationUpdate({
      notificationId,
      body: extractProps(body, ['is_read']),
      user: req.user,
    });
  }

  @Post('/api/v1/notifications/mark-all-read')
  @HttpCode(200)
  async markAllRead(@Req() req: Request) {
    return this.notificationsService.markAllRead({
      user: req.user,
    });
  }

  @Delete('/api/v1/notifications/:notificationId')
  // @Acl('notificationDelete')
  async notificationDelete(
    @Param('notificationId') notificationId,
    @Req() req: Request,
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
