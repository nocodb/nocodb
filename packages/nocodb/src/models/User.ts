import {
  extractRolesObj,
  IconType,
  ncIsObject,
  OrgUserRoles,
  ProjectRoles,
  type UserType,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
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
import WorkspaceUser from '~/models/WorkspaceUser';
import { Base, BaseUser, PresignedUrl, UserRefreshToken } from '~/models';
import { sanitiseUserObj } from '~/utils';
import { normalizeEmail } from '~/utils/emailUtils';
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

  is_new_user?: boolean;
  canonical_email?: string;

  totp_secret?: string;
  totp_enabled?: boolean;
  totp_backup_codes?: string;

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
      'canonical_email',
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
      'is_new_user',
      'meta',
      'totp_secret',
      'totp_enabled',
      'totp_backup_codes',
    ]);

    // Set is_new_user to true for new users if not explicitly set
    if (insertObj.is_new_user === undefined) {
      insertObj.is_new_user = true;
    }

    if (insertObj.email) {
      insertObj.email = insertObj.email.toLowerCase();
      insertObj.canonical_email = normalizeEmail(insertObj.email);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      prepareForDb(insertObj),
    );

    await NocoCache.del('root', CacheScope.INSTANCE_META);

    // clear all base user related cache for instance
    const bases = await Base.list(null, ncMeta);
    for (const base of bases) {
      await NocoCache.deepDel(
        { workspace_id: base.fk_workspace_id, base_id: base.id },
        `${CacheScope.BASE_USER}:${base.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    return this.get(id, ncMeta);
  }

  public static async update(id, user: Partial<User>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(user, [
      'email',
      'canonical_email',
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
      'is_new_user',
      'meta',
      'totp_secret',
      'totp_enabled',
      'totp_backup_codes',
    ]);

    if (updateObj.email) {
      updateObj.email = updateObj.email.toLowerCase();
      updateObj.canonical_email = normalizeEmail(updateObj.email);

      // check if the target email addr is in use or not
      const targetUser = await this.getByEmail(updateObj.email, ncMeta);
      if (targetUser && targetUser.id !== id) {
        NcError.badRequest('email is in use');
      }

      // check if a user with the same canonical email already exists
      const canonicalUser = await this.getByCanonicalEmail(
        updateObj.email,
        ncMeta,
      );
      if (canonicalUser && canonicalUser.id !== id) {
        NcError.badRequest('email is in use');
      }
    } else {
      // set email prop to avoid generation of invalid cache key
      updateObj.email = (await this.get(id, ncMeta))?.email?.toLowerCase();
    }

    // get old user
    const existingUser = await this.get(id, ncMeta);

    // delete the email-based cache to avoid unexpected behaviour since we can update email as well
    await NocoCache.del('root', `${CacheScope.USER}:${existingUser.email}`);

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
        'root',
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
        await NocoCache.set('root', `${CacheScope.USER}:${email}`, user);
      }
    }

    if (user?.is_deleted) {
      return null;
    }

    return this.castType(user);
  }

  /**
   * Look up a user by canonical (normalized) email.
   * Normalizes the input so any alias variant finds the right user.
   */
  public static async getByCanonicalEmail(
    _email: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!_email || _email === '') return null;

    const canonical = normalizeEmail(_email);
    let user =
      canonical &&
      (await NocoCache.get(
        'root',
        `${CacheScope.USER}:canonical:${canonical}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!user) {
      user = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.USERS,
        {
          canonical_email: canonical,
        },
      );

      if (user) {
        user.meta = parseMetaProp(user);
        await NocoCache.set(
          'root',
          `${CacheScope.USER}:canonical:${canonical}`,
          user,
        );
      }
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

    qb.where(function () {
      this.where('is_deleted', false).orWhereNull('is_deleted');
    });

    return (await qb.count('id', { as: 'count' }).first()).count;
  }

  static async get(userId, ncMeta = Noco.ncMeta): Promise<User> {
    let user =
      userId &&
      (await NocoCache.get(
        'root',
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
        await NocoCache.set('root', `${CacheScope.USER}:${userId}`, user);
      }
    }

    if (user?.is_deleted) {
      return null;
    }

    return this.castType(user);
  }

  /**
   * Get multiple users by IDs in a single query.
   * Falls back to cache for each ID first, then fetches remaining from DB.
   */
  static async getByIds(
    userIds: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, User>> {
    const result = new Map<string, User>();
    if (!userIds.length) return result;

    const uniqueIds = [...new Set(userIds)];
    const uncachedIds: string[] = [];

    for (const id of uniqueIds) {
      const cached = await NocoCache.get(
        'root',
        `${CacheScope.USER}:${id}`,
        CacheGetType.TYPE_OBJECT,
      );
      if (cached && !cached.is_deleted) {
        result.set(id, this.castType(cached));
      } else if (!cached) {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length) {
      const rows = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.USERS,
        {
          xcCondition: {
            _and: [
              { id: { in: uncachedIds } },
              {
                _or: [
                  { is_deleted: { eq: false } },
                  { is_deleted: { eq: null } },
                ],
              },
            ],
          },
        },
      );

      for (const row of rows) {
        row.meta = parseMetaProp(row);
        await NocoCache.set('root', `${CacheScope.USER}:${row.id}`, row);
        result.set(row.id, this.castType(row));
      }
    }

    return result;
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
        `${MetaTable.USERS}.is_new_user`,
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
      )
      .where(function () {
        this.where(`${MetaTable.USERS}.is_deleted`, false).orWhereNull(
          `${MetaTable.USERS}.is_deleted`,
        );
      });
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

  public static async softDelete(userId: string, ncMeta = Noco.ncMeta) {
    const user = await this.get(userId, ncMeta);

    if (!user) NcError.userNotFound(userId);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      {
        email: `deleted_${user.id}@user.invalid`,
        canonical_email: null,
        display_name: 'Anonymous',
        password: null,
        salt: null,
        avatar: null,
        invite_token: null,
        reset_password_token: null,
        email_verification_token: null,
        token_version: null,
        totp_secret: null,
        totp_enabled: false,
        totp_backup_codes: null,
        deleted_at: ncMeta.knex.fn.now(),
        is_deleted: true,
      },
      userId,
    );

    await this.clearCache(userId, ncMeta);
  }

  static async getWithRoles(
    context: NcContext,
    userId: string,
    args: {
      user?: User;
      baseId?: string;
      orgId?: string;
      workspaceId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const user = args.user ?? (await this.get(userId, ncMeta));

    if (!user) NcError.userNotFound(userId);

    // Super admin is treated as owner of all workspaces and bases
    if (extractRolesObj(user.roles)?.[OrgUserRoles.SUPER_ADMIN]) {
      return {
        ...sanitiseUserObj(user),
        roles: extractRolesObj(user.roles),
        workspace_roles: args.workspaceId
          ? { [WorkspaceUserRoles.OWNER]: true }
          : null,
        base_roles: args.baseId ? { [ProjectRoles.OWNER]: true } : null,
      } as any;
    }

    const baseRoles = await new Promise((resolve) => {
      if (args.baseId) {
        BaseUser.get(context, args.baseId, user.id, ncMeta).then(
          async (baseUser) => {
            const roles = baseUser?.roles;
            // + (user.roles ? `,${user.roles}` : '');
            if (roles) {
              // If role is INHERIT (can be 'inherit' string), treat it as null to fall back to workspace roles
              // Since INHERIT at base level means inherit from workspace level
              if (roles === ProjectRoles.INHERIT) {
                resolve(null);
              } else {
                resolve(extractRolesObj(roles));
              }
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

    let workspaceRoles: Record<string, boolean> | null = null;

    if (args.workspaceId) {
      const wsUser = await WorkspaceUser.get(
        args.workspaceId,
        user.id,
        {},
        ncMeta,
      );
      if (wsUser?.roles) {
        workspaceRoles = extractRolesObj(wsUser.roles);
      }
    }

    // If no explicit base role, inherit from workspace role
    let effectiveBaseRoles = baseRoles;
    if (!effectiveBaseRoles && workspaceRoles) {
      const wsRoleStr = Object.keys(workspaceRoles).find(
        (k) => workspaceRoles[k],
      ) as WorkspaceUserRoles | undefined;
      if (wsRoleStr) {
        const projectRole = WorkspaceRolesToProjectRoles[wsRoleStr];
        if (
          projectRole &&
          projectRole !== ProjectRoles.NO_ACCESS &&
          projectRole !== ProjectRoles.INHERIT
        ) {
          effectiveBaseRoles = extractRolesObj(projectRole);
        }
      }
    }

    return {
      ...sanitiseUserObj(user),
      roles: user.roles ? extractRolesObj(user.roles) : null,
      base_roles: effectiveBaseRoles ? effectiveBaseRoles : null,
      workspace_roles: workspaceRoles,
    } as UserType & {
      roles: Record<string, boolean>;
      base_roles: Record<string, boolean>;
      workspace_roles: Record<string, boolean>;
    };
  }

  protected static async clearCache(userId: string, ncMeta = Noco.ncMeta) {
    const user = await this.get(userId, ncMeta);
    if (!user) NcError.userNotFound(userId);

    // todo: skip base user cache delete based on flag
    const bases = await BaseUser.getProjectsList(userId, {}, ncMeta);

    for (const base of bases) {
      await NocoCache.deepDel(
        { workspace_id: base.fk_workspace_id, base_id: base.id },
        `${CacheScope.BASE_USER}:${base.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    // clear all user related cache
    await NocoCache.del('root', `${CacheScope.USER}:${userId}`);
    await NocoCache.del('root', `${CacheScope.USER}:${user.email}`);
    if (user.email) {
      await NocoCache.del(
        'root',
        `${CacheScope.USER}:canonical:${normalizeEmail(user.email)}`,
      );
    }
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
