import type { AppEvents } from 'nocodb-sdk';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';

export default class Notification {
  id?: string;
  body?: string | Record<string, any>;
  is_read?: boolean | number;
  is_deleted?: boolean;
  fk_user_id?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
  type?: AppEvents;

  constructor(notification: Partial<Notification>) {
    Object.assign(this, notification);
  }

  public static async insert(
    notification: Partial<Notification>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertData = extractProps(notification, [
      'body',
      'type',
      'fk_user_id',
      'is_read',
      'is_deleted',
    ]);

    insertData.body = stringifyMetaProp(insertData, 'body');

    return await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.NOTIFICATION,
      insertData,
    );
  }

  public static async list(
    params: {
      fk_user_id: string;
      limit?: number;
      offset?: number;
      is_read?: boolean;
      is_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const { limit = 10, offset = 0 } = params;

    const condition = extractProps(params, [
      'is_read',
      'is_deleted',
      'fk_user_id',
    ]);

    const notifications = await ncMeta.metaList(
      null,
      null,
      MetaTable.NOTIFICATION,
      {
        condition,
        limit,
        offset,
      },
    );

    for (const notification of notifications) {
      notification.body = parseMetaProp(notification, 'body');
    }

    return notifications;
  }

  public static async count(
    params: {
      fk_user_id: string;
      is_read?: boolean;
      is_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, [
      'is_read',
      'is_deleted',
      'fk_user_id',
    ]);
    const count = await ncMeta.metaCount(null, null, MetaTable.NOTIFICATION, {
      condition,
    });

    return count;
  }

  public static async update(
    id,
    notification: Partial<Notification>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateData = extractProps(notification, [
      'body',
      'type',
      'fk_user_id',
      'is_read',
      'is_deleted',
    ]);

    if ('body' in updateData) {
      updateData.body = stringifyMetaProp(updateData, 'body');
    }

    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.NOTIFICATION,
      updateData,
      id,
    );
  }

  public static async markAllAsRead(fk_user_id: string, ncMeta = Noco.ncMeta) {
    return ncMeta.metaUpdate(
      null,
      null,
      MetaTable.NOTIFICATION,
      { is_read: true },
      {
        fk_user_id,
        is_read: false,
      },
    );
  }
}
