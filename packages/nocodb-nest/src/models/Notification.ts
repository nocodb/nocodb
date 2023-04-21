import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import { extractProps } from '../helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '../utils/modelUtils';
import type { AppEvents } from '../services/app-hooks.service';

export default class Notification {
  id?: string;
  body?: string | Record<string, any>;
  // todo: use enum
  type?: AppEvents;
  is_read?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  fk_user_id?: string;

  constructor(notification: Partial<Notification>) {
    Object.assign(this, notification);
  }

  // todo: cache
  public static async get(idOrCondition: string | Record<string, any>) {
    const notification = await Noco.ncMeta.metaGet2(
      null,
      null,
      MetaTable.NOTIFICATION,
      idOrCondition,
    );
    return notification && new Notification(notification);
  }

  // todo: cache
  public static async insert(
    notification: Partial<Notification>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(notification, [
      'id',
      'body',
      'type',
      'is_read',
      'is_deleted',
      'created_at',
      'updated_at',
      'fk_user_id',
    ]);

    if ('body' in insertObj)
      insertObj.body = stringifyMetaProp(insertObj, 'body') as string;

    return await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.NOTIFICATION,
      insertObj,
    );
  }

  // todo: cache
  public static async update(
    idOrCondition: string | Record<string, any>,
    notification: Partial<Notification>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(notification, [
      'body',
      'type',
      'is_read',
      'is_deleted',
      'created_at',
      'updated_at',
      'fk_user_id',
    ]);

    if ('body' in updateObj)
      updateObj.body = stringifyMetaProp(updateObj, 'body') as string;

    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.NOTIFICATION,
      idOrCondition,
      updateObj,
    );
  }

  // todo: cache
  static async list(param: {
    fk_user_id: string;
    is_read?: boolean;
    is_deleted?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where = { fk_user_id: param.fk_user_id };

    if ('is_read' in param) where['is_read'] = param.is_read;
    if ('is_deleted' in param) where['is_deleted'] = param.is_deleted;

    const { limit, offset } = param;

    const notifications = await Noco.ncMeta.metaList2(
      null,
      null,
      MetaTable.NOTIFICATION,
      { limit, offset, condition: where },
    );

    return notifications.map((n) => {
      n.body = parseMetaProp(n, 'body');
      return new Notification(n);
    });
  }

  // todo: cache
  static async count(param: {
    fk_user_id: string;
    is_read?: boolean;
    is_deleted?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where = { fk_user_id: param.fk_user_id };

    if ('is_read' in param) where['is_read'] = param.is_read;
    if ('is_deleted' in param) where['is_deleted'] = param.is_deleted;

    const count = await Noco.ncMeta.metaCount(
      null,
      null,
      MetaTable.NOTIFICATION,
      { condition: where },
    );

    return count;
  }
}
