import {
  extractRolesObj,
  IconType,
  ncIsObject,
  type UserType,
} from 'nocodb-sdk';
import type { MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { Base, BaseUser, PresignedUrl, UserRefreshToken } from '~/models';
import { sanitiseUserObj } from '~/utils';
import { parseMetaProp, prepareForDb } from '~/utils/modelUtils';

export default class User implements UserType {
  id: string;

  /** @format email */
  email: string;

  password?: string;
  salt?: string;
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

  blocked?: boolean;
  blocked_reason?: string;

  deleted_at?: Date;
  is_deleted?: boolean;
  meta?: MetaType;

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
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles',
      'token_version',
      'meta',
    ]);

    if (insertObj.email) {
      insertObj.email = insertObj.email.toLowerCase();
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      prepareForDb(insertObj),
    );

    await NocoCache.del(CacheScope.INSTANCE_META);

    // clear all base user related cache for instance
    const bases = await Base.list(null, ncMeta);
    for (const base of bases) {
      await NocoCache.deepDel(
        `${CacheScope.BASE_USER}:${base.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    return this.get(id, ncMeta);
  }

  public static async update(id, user: Partial<User>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(user, [
      'email',
      'password',
      'salt',
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
      'meta',
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

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      prepareForDb(updateObj),
      id,
    );

    // clear all user related cache
    await this.clearCache(id, ncMeta);

    return this.get(id, ncMeta);
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
      user = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.USERS,
        {
          email,
        },
      );

      if (user) {
        user.meta = parseMetaProp(user);
      }

      await NocoCache.set(`${CacheScope.USER}:${email}`, user);
    }

    if (user?.is_deleted) {
      return null;
    }

    return this.castType(user);
  }

  static async isFirst(ncMeta = Noco.ncMeta) {
    return !(await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      {},
    ));
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
      user = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.USERS,
        userId,
      );

      if (user) {
        user.meta = parseMetaProp(user);
      }

      await NocoCache.set(`${CacheScope.USER}:${userId}`, user);
    }

    if (user?.is_deleted) {
      return null;
    }

    return this.castType(user);
  }

  static async getByRefreshToken(refresh_token, ncMeta = Noco.ncMeta) {
    const userRefreshToken = await UserRefreshToken.getByToken(
      refresh_token,
      ncMeta,
    );

    if (!userRefreshToken) {
      return null;
    }

    const user = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      userRefreshToken.fk_user_id,
    );

    if (user?.is_deleted) {
      return null;
    }

    if (user) {
      user.meta = parseMetaProp(user);
    }

    return this.castType(user);
  }

  public static async list(
    {
      limit,
      offset,
      query = '',
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
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.meta`,
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
      queryBuilder.where(function () {
        this.where(function () {
          this.whereNotNull('display_name')
            .andWhereNot('display_name', '')
            .andWhere('display_name', 'like', `%${query.toLowerCase()}%`);
        }).orWhere(function () {
          this.where('email', 'like', `%${query.toLowerCase()}%`);
        });
      });
    }

    return queryBuilder;
  }

  static async delete(userId: string, ncMeta = Noco.ncMeta) {
    if (!userId) NcError.badRequest('userId is required');

    const user = await this.get(userId, ncMeta);

    if (!user) NcError.userNotFound(userId);

    // clear all user related cache
    await this.clearCache(userId, ncMeta);

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      userId,
    );
  }

  static async getWithRoles(
    context: NcContext,
    userId: string,
    args: {
      user?: User;
      baseId?: string;
      orgId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const user = args.user ?? (await this.get(userId, ncMeta));

    if (!user) NcError.userNotFound(userId);

    const baseRoles = await new Promise((resolve) => {
      if (args.baseId) {
        BaseUser.get(context, args.baseId, user.id, ncMeta).then(
          async (baseUser) => {
            const roles = baseUser?.roles;
            // + (user.roles ? `,${user.roles}` : '');
            if (roles) {
              resolve(extractRolesObj(roles));
            } else {
              resolve(null);
            }
            // todo: cache
          },
        );
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

  protected static async clearCache(userId: string, ncMeta = Noco.ncMeta) {
    const user = await this.get(userId, ncMeta);
    if (!user) NcError.userNotFound(userId);

    // todo: skip base user cache delete based on flag
    const bases = await BaseUser.getProjectsList(userId, {}, ncMeta);

    for (const base of bases) {
      await NocoCache.deepDel(
        `${CacheScope.BASE_USER}:${base.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    // clear all user related cache
    await NocoCache.del(`${CacheScope.USER}:${userId}`);
    await NocoCache.del(`${CacheScope.USER}:${user.email}`);
  }

  public static async signUserImage(
    users: Partial<UserType> | Partial<UserType>[],
  ) {
    if (!users) return;

    const promises = [];

    try {
      for (const user of Array.isArray(users) ? users : [users]) {
        if (!ncIsObject(user)) {
          continue;
        }

        user.meta = parseMetaProp(user);

        if (
          user.meta &&
          (user.meta as Record<string, any>).icon &&
          (user.meta as Record<string, any>).iconType === IconType.IMAGE
        ) {
          promises.push(
            PresignedUrl.signAttachment({
              attachment: (user.meta as Record<string, any>).icon,
            }),
          );
        }
      }

      await Promise.all(promises);
    } catch {}
  }
}
