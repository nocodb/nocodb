import { UserType } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import Noco from '../noco/Noco';
import extractProps from '../noco/meta/helpers/extractProps';
import NocoCache from '../noco-cache/NocoCache';
export default class User implements UserType {
  id: number;

  /** @format email */
  email: string;

  password?: string;
  salt?: string;
  firstname: string;
  lastname: string;
  username?: string;
  refresh_token?: string;
  invite_token?: string;
  invite_token_expires?: number | Date;
  reset_password_expires?: number | Date;
  reset_password_token?: string;
  email_verification_token?: string;
  email_verified: boolean;
  roles?: string;

  constructor(data: User) {
    Object.assign(this, data);
  }

  public static async insert(user: Partial<User>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(user, [
      'id',
      'email',
      'password',
      'salt',
      'firstname',
      'lastname',
      'username',
      'refresh_token',
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles'
    ]);
    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.USERS,
      insertObj
    );
    return this.get(id, ncMeta);
  }
  public static async update(id, user: Partial<User>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(user, [
      'email',
      'password',
      'salt',
      'firstname',
      'lastname',
      'username',
      'refresh_token',
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles'
    ]);
    // get existing cache
    let key = `${CacheScope.USER}:${id}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
      {
        // update user:<email>
        key = `${CacheScope.USER}:${o.email}`;
        o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
        if (o) {
          o = { ...o, ...updateObj };
          // set cache
          await NocoCache.set(key, o);
        }
      }
    }
    // set meta
    return await ncMeta.metaUpdate(null, null, MetaTable.USERS, updateObj, id);
  }
  public static async getByEmail(email, ncMeta = Noco.ncMeta) {
    let user =
      email &&
      (await NocoCache.get(
        `${CacheScope.USER}:${email}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!user) {
      user = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
        email
      });
      await NocoCache.set(`${CacheScope.USER}:${email}`, user);
    }
    return user;
  }

  static async isFirst(ncMeta = Noco.ncMeta) {
    const isFirst = !(await NocoCache.getAll(`${CacheScope.USER}:*`))?.length;
    if (isFirst)
      return !(await ncMeta.metaGet2(null, null, MetaTable.USERS, {}));
    return false;
  }

  static async count(ncMeta = Noco.ncMeta) {
    return (
      await ncMeta
        .knex(MetaTable.USERS)
        .count('id', { as: 'count' })
        .first()
    )?.count;
  }

  static async get(userId, ncMeta = Noco.ncMeta) {
    let user =
      userId &&
      (await NocoCache.get(
        `${CacheScope.USER}:${userId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!user) {
      user = await ncMeta.metaGet2(null, null, MetaTable.USERS, userId);
      await NocoCache.set(`${CacheScope.USER}:${userId}`, user);
    }
    return user;
  }
}
