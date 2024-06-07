import type { AppEvents } from 'nocodb-sdk';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

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

    return await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.NOTIFICATION,
      prepareForDb(insertData, 'body'),
    );
  }

  public static async get(
    params: {
      fk_user_id: string;
      id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, ['id', 'fk_user_id']);

    return await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.NOTIFICATION,
      condition,
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

    const notifications = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.NOTIFICATION,
      {
        condition,
        limit,
        offset,
        orderBy: {
          created_at: 'desc',
        },
      },
    );

    for (const notification of notifications) {
      prepareForResponse(notification, 'body');
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
    const count = await ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.NOTIFICATION,
      {
        condition,
      },
    );

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

    return await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.NOTIFICATION,
      prepareForDb(updateData, 'body'),
      id,
    );
  }

  public static async markAllAsRead(fk_user_id: string, ncMeta = Noco.ncMeta) {
    return ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.NOTIFICATION,
      { is_read: true },
      {
        fk_user_id,
        is_read: false,
      },
    );
  }
}
