import { Injectable } from '@nestjs/common';
import { Notification } from '../models';
import type { UserType } from 'nocodb-sdk';

@Injectable()
export class NotificationsService {
  notificationList(param: {
    user: UserType;
    limit?: number;
    offset?: number;
    is_read?: boolean;
    is_deleted?: boolean;
  }) {
    return Notification.list({
      fk_user_id: param.user.id,
      limit: param.limit,
      offset: param.offset,
      is_read: param.is_read,
      is_deleted: param.is_deleted,
    });
  }

  notificationUpdate(param: { notificationId: string; body; user: UserType }) {
    return Promise.resolve(undefined);
  }

  notificationDelete(param: { notificationId: string; user: UserType }) {
    return Promise.resolve(undefined);
  }
}
