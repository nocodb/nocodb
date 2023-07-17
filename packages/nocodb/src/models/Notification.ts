import {MetaTable, UserType} from 'nocodb-sdk';
import {extractProps} from '../helpers/extractProps';
import Noco from '../Noco';
import {parseMetaProp, stringifyMetaProp} from "../utils/modelUtils";
import {NcError} from "../helpers/catchError";

export default class Notification {
  id?: string;
  body?: string | Record<string, any>;
  is_read?: boolean | number;
  is_deleted?: boolean;
  fk_user_id?: string;
  created_at?: string | Date;

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

    return await ncMeta.insert(MetaTable.NOTIFICATION, insertData);
  }

  public static async list(
    {
      fk_user_id,
      limit = 10,
      offset = 0,
      is_read = false,
      is_deleted = false,
    }: {
      fk_user_id: string;
      limit?: number;
      offset?: number;
      is_read?: boolean;
      is_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const notifications = await ncMeta.metaList(
      null,
      null,
      MetaTable.NOTIFICATION,
      {
        condition: {
          fk_user_id,
          is_read,
          is_deleted,
        },
        limit,
        offset,
      }
    )

    for (const notification of notifications) {
      notification.body = parseMetaProp(notification, 'body');
    }

    return notifications;
  }

  public static async count(
    {
      fk_user_id,
      is_read ,
      is_deleted ,
    }: {
      fk_user_id: string;
      is_read?: boolean;
      is_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const count = await ncMeta.metaCount(
      null,
      null,
      MetaTable.NOTIFICATION,
      {
        condition: {
          fk_user_id,
          is_read,
          is_deleted,
        }
      }
    )

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

    if('body' in updateData) {
      updateData.body = stringifyMetaProp(updateData, 'body');
    }

    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.NOTIFICATION,
      updateData,
      id
    );
  }

  public static async markAllAsRead(
    fk_user_id: string,
    ncMeta = Noco.ncMeta,
  ) {


return ncMeta.metaUpdate(
      null,
      null,
      MetaTable.NOTIFICATION,
      {
        condition: {
          fk_user_id,
          is_read: false,
        }
      }
    )

  }
}
