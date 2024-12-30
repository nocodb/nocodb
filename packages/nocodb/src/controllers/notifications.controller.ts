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
  Res,
  UseGuards,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Response } from 'express';
import { NotificationsService } from '~/services/notifications/notifications.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { extractProps } from '~/helpers/extractProps';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import { PubSubRedis } from '~/redis/pubsub-redis';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const POLL_INTERVAL = 30000;

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class NotificationsController implements OnApplicationShutdown {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('/api/v1/notifications/poll')
  @Acl('notification', {
    scope: 'org',
  })
  async notificationPoll(
    @Req() req: NcRequest,
    @Res()
    res: Response & {
      resId: string;
    },
  ) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.resId = nanoidv2();

    this.notificationsService.addConnection(req.user.id, res);

    let unsubscribeCallback: (keepRedisChannel?: boolean) => Promise<void> =
      null;

    if (PubSubRedis.available) {
      unsubscribeCallback = await PubSubRedis.subscribe(
        `notification:${req.user.id}`,
        async (data) => {
          this.notificationsService.sendToConnections(req.user.id, data);
        },
      );
    }

    res.on('close', async () => {
      await this.notificationsService.removeConnection(
        req.user.id,
        res,
        unsubscribeCallback,
      );
    });

    setTimeout(() => {
      if (!res.headersSent) {
        res.send({
          status: 'refresh',
        });
      }
    }, POLL_INTERVAL);
  }

  @Get('/api/v1/notifications')
  @Acl('notification', {
    scope: 'org',
  })
  async notificationList(@Req() req: NcRequest) {
    return this.notificationsService.notificationList({
      user: req.user,
      is_deleted: false,
      ...req.query,
      is_read: req.query.is_read === 'true',
    });
  }

  @Patch('/api/v1/notifications/:notificationId')
  @Acl('notification', {
    scope: 'org',
  })
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

  @Delete('/api/v1/notifications/:notificationId')
  @Acl('notification', {
    scope: 'org',
  })
  async notificationDelete(
    @Param('notificationId') notificationId,
    @Req() req: NcRequest,
  ) {
    return this.notificationsService.notificationDelete({
      notificationId,
      user: req.user,
    });
  }

  @Post('/api/v1/notifications/mark-all-read')
  @Acl('notification', {
    scope: 'org',
  })
  @HttpCode(200)
  async markAllRead(@Req() req: NcRequest) {
    return this.notificationsService.markAllRead({
      user: req.user,
    });
  }

  async onApplicationShutdown() {
    /*
     * Close all long polling connections
     */
    for (const userId in this.notificationsService.connections) {
      for (const res of this.notificationsService.connections[userId]) {
        if (!res.headersSent) {
          res.send({
            status: 'refresh',
          });
        }
      }
    }
  }
}
