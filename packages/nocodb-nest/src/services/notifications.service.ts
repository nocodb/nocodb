import { Injectable } from '@nestjs/common';
import { Notification } from '../models';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import type { UserType } from 'nocodb-sdk';

@Injectable()
export class NotificationsService {
  async notificationList(param: {
    user: UserType;
    limit?: number;
    offset?: number;
    is_read?: boolean;
    is_deleted?: boolean;
  }) {
    const list = await Notification.list({
      fk_user_id: param.user.id,
      limit: param.limit,
      offset: param.offset,
      is_read: param.is_read,
      is_deleted: param.is_deleted,
    });

    const count = await Notification.count({
      fk_user_id: param.user.id,
      limit: param.limit,
      offset: param.offset,
      is_read: param.is_read,
      is_deleted: param.is_deleted,
    });

    return new PagedResponseImpl(list, {
      limit: param.limit,
      offset: param.offset,
      count,
    });
  }

  notificationUpdate(param: { notificationId: string; body; user: any }) {
    return Notification.update(
      {
        id: param.notificationId,
        fk_user_id: param.user.id,
      },
      param.body,
    );
  }

  // // soft delete
  // notificationDelete(param: { notificationId: string; user: UserType }) {
  //   return Notification.update(param.notificationId, {
  //     is_deleted: true,
  //   });
  // }

//   // todo: validation
//   notificationDelete(param: { notificationId: string; user: UserType }) {
//     return;
//   }
// }
