import { extractRolesObj, type UserType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { BaseUser } from '~/models';
import { sanitiseUserObj } from '~/utils';

export default class User implements UserType {
  id: string;

  /** @format email */
  email: string;

  password?: string;
  salt?: string;
  refresh_token?: string;
  invite_token?: string;
  invite_token_expires?: number | Date;
  reset_password_expires?: number | Date;
  reset_password_token?: string;
  email_verification_token?: string;
  email_verified: boolean;
  roles?: string;
  token_version?: string;

  display_name?: string;
  avatar?: string;

  constructor(data: User) {
    Object.assign(this, data);
  }

  protected static castType(user: User): User {
    return user && new User(user);
  }

  public static async insert(user: Partial<User>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(user, [
      'id',
      'email',
      'password',
      'salt',
      'refresh_token',
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles',
      'token_version',
    ]);

    if (insertObj.email) {
      insertObj.email = insertObj.email.toLowerCase();
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.USERS,
      insertObj,
    );

    await NocoCache.del(CacheScope.INSTANCE_META);

    return this.get(id, ncMeta);
  }

  public static async update(id, user: Partial<User>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(user, [
      'email',
      'password',
      'salt',
      'refresh_token',
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles',
      'token_version',
      'display_name',
      'avatar',
    ]);

    if (updateObj.email) {
      updateObj.email = updateObj.email.toLowerCase();

      // check if the target email addr is in use or not
      const targetUser = await this.getByEmail(updateObj.email, ncMeta);
      if (targetUser && targetUser.id !== id) {
        NcError.badRequest('email is in use');
      }
    } else {
      // set email prop to avoid generation of invalid cache key
      updateObj.email = (await this.get(id, ncMeta))?.email?.toLowerCase();
    }

    // get old user
    const existingUser = await this.get(id, ncMeta);

    // delete the email-based cache to avoid unexpected behaviour since we can update email as well
    await NocoCache.del(`${CacheScope.USER}:${existingUser.email}`);

    // as <baseId> is unknown, delete user:<email>___<baseId> in cache
    await NocoCache.delAll(CacheScope.USER, `${existingUser.email}___*`);

    // get existing cache
    const keys = [
      // update user:<id>
      `${CacheScope.USER}:${id}`,
    ];
    for (const key of keys) {
      let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        o = { ...o, ...updateObj };
        // set cache
        await NocoCache.set(key, o);
      }
    }

    // set meta
    return await ncMeta.metaUpdate(null, null, MetaTable.USERS, updateObj, id);
  }

  public static async getByEmail(_email: string, ncMeta = Noco.ncMeta) {
    const email = _email?.toLowerCase();
    let user =
      email &&
      (await NocoCache.get(
        `${CacheScope.USER}:${email}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!user) {
      user = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
        email,
      });
      await NocoCache.set(`${CacheScope.USER}:${email}`, user);
    }
    return this.castType(user);
  }

  static async isFirst(ncMeta = Noco.ncMeta) {
    const isFirst = !(await NocoCache.getAll(`${CacheScope.USER}:*`))?.length;
    if (isFirst)
      return !(await ncMeta.metaGet2(null, null, MetaTable.USERS, {}));
    return false;
  }

  public static async count(
    {
      query = '',
    }: {
      query?: string;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const qb = ncMeta.knex(MetaTable.USERS);

    if (query) {
      qb.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    return (await qb.count('id', { as: 'count' }).first()).count;
  }

  static async get(userId, ncMeta = Noco.ncMeta): Promise<User> {
    let user =
      userId &&
      (await NocoCache.get(
        `${CacheScope.USER}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!user) {
      user = await ncMeta.metaGet2(null, null, MetaTable.USERS, userId);
      await NocoCache.set(`${CacheScope.USER}:${userId}`, user);
    }
    return this.castType(user);
  }

  static async getByRefreshToken(refresh_token, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaGet2(null, null, MetaTable.USERS, {
      refresh_token,
    });
  }

  public static async list(
    {
      limit,
      offset,
      query,
    }: {
      limit?: number | undefined;
      offset?: number | undefined;
      query?: string;
    } = {},
    ncMeta = Noco.ncMeta,
  ) {
    let queryBuilder = ncMeta.knex(MetaTable.USERS);

    if (offset) queryBuilder = queryBuilder.offset(offset);

    if (limit) queryBuilder = queryBuilder.limit(limit);

    queryBuilder = queryBuilder
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.email_verified`,
        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.created_at`,
        `${MetaTable.USERS}.updated_at`,
        `${MetaTable.USERS}.roles`,
      )
      .select(
        ncMeta
          .knex(MetaTable.PROJECT_USERS)
          .count()
          .whereRaw(
            `${MetaTable.USERS}.id = ${MetaTable.PROJECT_USERS}.fk_user_id`,
          )
          .as('projectsCount'),
      );
    if (query) {
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    return queryBuilder;
  }

  static async delete(userId: string, ncMeta = Noco.ncMeta) {
    if (!userId) NcError.badRequest('userId is required');

    const user = await this.get(userId, ncMeta);

    if (!user) NcError.badRequest('User not found');

    // clear all user related cache
    await NocoCache.delAll(CacheScope.USER, `${userId}___*`);
    await NocoCache.delAll(CacheScope.USER, `${user.email}___*`);
    await NocoCache.del(`${CacheScope.USER}:${userId}`);
    await NocoCache.del(`${CacheScope.USER}:${user.email}`);

    return await ncMeta.metaDelete(null, null, MetaTable.USERS, userId);
  }

  static async getWithRoles(
    userId: string,
    args: {
      user?: User;
      baseId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const user = args.user ?? (await this.get(userId, ncMeta));

    if (!user) NcError.badRequest('User not found');

    const baseRoles = await new Promise((resolve) => {
      if (args.baseId) {
        BaseUser.get(args.baseId, user.id).then(async (baseUser) => {
          const roles = baseUser?.roles;
          // + (user.roles ? `,${user.roles}` : '');
          if (roles) {
            resolve(extractRolesObj(roles));
          } else {
            resolve(null);
          }
          // todo: cache
        });
      } else {
        resolve(null);
      }
    });

    return {
      ...sanitiseUserObj(user),
      roles: user.roles ? extractRolesObj(user.roles) : null,
      base_roles: baseRoles ? baseRoles : null,
    } as any;
  }
}
