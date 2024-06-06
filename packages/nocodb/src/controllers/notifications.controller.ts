import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { customAlphabet } from 'nanoid';
import { NotificationsService } from '~/services/notifications/notifications.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { extractProps } from '~/helpers/extractProps';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const POLL_INTERVAL = 30000;

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('/api/v1/notifications/poll')
  // @Acl('notificationList')
  // TODO: @DarkPhoenix2704 ACL?
  async notificationPoll(
    @Req() req: NcRequest,
    @Res()
    res: Response & {
      resId: string;
    },
  ) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.resId = nanoidv2();
  }

  @Get('/api/v1/notifications')
  // @Acl('notificationList')
  // TODO: @DarkPhoenix2704 ACL?
  async notificationList(@Req() req: NcRequest, @Res() res: Response) {
    return this.notificationsService.notificationList({
      user: req.user,
      is_deleted: false,
      ...req.query,
      is_read: req.query.is_read === 'true',
    });
  }

  @Patch('/api/v1/notifications/:notificationId')
  // TODO: @DarkPhoenix2704 ACL?
  // @Acl('notificationUpdate')
  async notificationUpdate(
    @Param('notificationId') notificationId,
    @Body() body,
    @Req() req: NcRequest,
  ) {
    return this.notificationsService.notificationUpdate({
      notificationId,
      body: extractProps(body, ['is_read']),
      user: req.user,
    });
  }

  @Post('/api/v1/notifications/mark-all-read')
  @HttpCode(200)
  // TODO: @DarkPhoenix2704 ACL?
  async markAllRead(@Req() req: NcRequest) {
    return this.notificationsService.markAllRead({
      user: req.user,
    });
  }
}
