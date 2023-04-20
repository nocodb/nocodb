import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import { extractProps } from '../helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '../utils/modelUtils';

export default class Audit {
  id?: string;
  body?: string | Record<string, any>;
  // todo: use enum
  type?: string;
  is_read?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  fk_user_id?: string;

  constructor(notification: Partial<Audit>) {
    Object.assign(this, notification);
  }

  // todo: cache
  public static async get(notificationId: string) {
    const notification = await Noco.ncMeta.metaGet2(
      null,
      null,
      MetaTable.NOTIFICATION,
      notificationId,
    );
    return notification && new Audit(notification);
  }

  // todo: cache
  public static async insert(
    notification: Partial<Audit>,
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

    return await ncMeta.metaInsert2(null, null, MetaTable.AUDIT, insertObj);
  }

  // todo: cache
  public static async update(
    id: string,
    notification: Partial<Audit>,
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

    return await ncMeta.metaUpdate(null, null, MetaTable.AUDIT, id, updateObj);
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
      where,
      { limit, offset },
    );

    return notifications.map((n) => {
      n.body = parseMetaProp(n, 'body');
      return new Audit(n);
    });
  }
}
