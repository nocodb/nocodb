import UserCE from 'src/models/User';
import { extractRolesObj, type UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { BaseUser, OrgUser, WorkspaceUser } from '~/models';
import { sanitiseUserObj } from '~/utils';
import { mapWorkspaceRolesObjToProjectRolesObj } from '~/utils/roleHelper';
import { parseMetaProp, prepareForDb } from '~/utils/modelUtils';

export default class User extends UserCE implements UserType {
  user_name?: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;

  protected static castType(user: User): User {
    return user && new User(user);
  }

  public static async insert(user: Partial<User>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(user, [
      'id',
      'email',
      'password',
      'salt',
      'user_name',
      'display_name',
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles',
      'token_version',
      'bio',
      'location',
      'website',
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

    return this.get(id, ncMeta);
  }

  public static async update(id, user: Partial<User>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(user, [
      'email',
      'password',
      'salt',
      'avatar',
      'display_name',
      'user_name',
      'invite_token',
      'invite_token_expires',
      'reset_password_expires',
      'reset_password_token',
      'email_verification_token',
      'email_verified',
      'roles',
      'token_version',
      'bio',
      'location',
      'website',
      'meta',
    ]);

    if (updateObj.user_name) {
      // check if the target username is in use or not
      const targetUser = await this.getByUsername(updateObj.user_name, ncMeta);
      if (targetUser.id === id) {
        NcError.badRequest('username is in use');
      }
    }

    if (updateObj.email) {
      updateObj.email = updateObj.email.toLowerCase();

      // check if the target email addr is in use or not
      const targetUser = await this.getByEmail(updateObj.email, ncMeta);
      if (targetUser.id !== id) {
        NcError.badRequest('email is in use');
      }
    } else {
      // set email prop to avoid generation of invalid cache key
      updateObj.email = (await this.get(id, ncMeta))?.email?.toLowerCase();
    }

    // get old user
    const existingUser = await this.get(id, ncMeta);

    // delete the email-based cache to avoid unexpected behaviour since we can update email as well
    await NocoCache.deepDel(
      `${CacheScope.USER}:${existingUser.email}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

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

  // TODO: cache
  public static async getByUsername(username: string, ncMeta = Noco.ncMeta) {
    const user = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      {
        user_name: username,
      },
    );

    if (user) {
      user.meta = parseMetaProp(user);
    }

    return this.castType(user);
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
        `${MetaTable.USERS}.avatar`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.user_name`,
        `${MetaTable.USERS}.email_verified`,
        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.created_at`,
        `${MetaTable.USERS}.updated_at`,
        `${MetaTable.USERS}.roles`,
        `${MetaTable.USERS}.bio`,
        `${MetaTable.USERS}.location`,
        `${MetaTable.USERS}.website`,
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
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    let users = await queryBuilder;

    users = users.map((user) => {
      user.meta = parseMetaProp(user);
      return user;
    });

    return users;
  }

  // TODO: cache
  static async getUserProfile(
    userId,
    ncMeta = Noco.ncMeta,
  ): Promise<Partial<UserType>> {
    const profile = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      userId,
      [
        'id',
        'email',
        'avatar',
        'user_name',
        'display_name',
        'bio',
        'location',
        'website',
        'meta',
      ],
    );

    if (profile) {
      profile.meta = parseMetaProp(profile);
    }

    const followerCount = (await this.getFollowerList(userId)).length;
    const followingCount = (await this.getFollowingList(userId)).length;
    return {
      ...profile,
      followerCount,
      followingCount,
    };
  }

  // TODO: cache
  static async getFollower(
    {
      fk_user_id,
      fk_follower_id,
    }: {
      fk_user_id: string;
      fk_follower_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<UserType> {
    return await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.FOLLOWER,
      {
        fk_user_id,
        fk_follower_id,
      },
    );
  }

  // TODO: cache
  static async getFollowerList(
    userId: string,
    {
      limit,
      offset,
    }: {
      limit?: number | undefined;
      offset?: number | undefined;
    } = {},
    ncMeta = Noco.ncMeta,
  ) {
    if (!userId) NcError.badRequest('userId is required');

    let qb = ncMeta.knex(MetaTable.USERS);

    if (offset) qb = qb.offset(offset);

    if (limit) qb = qb.limit(limit);

    qb = qb
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.avatar`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.user_name`,
        `${MetaTable.USERS}.meta`,
      )
      .whereIn(
        `${MetaTable.USERS}.id`,
        ncMeta
          .knex(MetaTable.FOLLOWER)
          .select('fk_user_id')
          .where('fk_follower_id', userId),
      );

    let users = await qb;

    users = users.map((user) => {
      user.meta = parseMetaProp(user);
      return user;
    });

    return users;
  }

  // TODO: cache
  static async getFollowingList(
    userId: string,
    {
      limit,
      offset,
    }: {
      limit?: number | undefined;
      offset?: number | undefined;
    } = {},
    ncMeta = Noco.ncMeta,
  ) {
    if (!userId) NcError.badRequest('userId is required');

    let qb = ncMeta.knex(MetaTable.USERS);

    if (offset) qb = qb.offset(offset);

    if (limit) qb = qb.limit(limit);

    qb = qb
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.avatar`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.user_name`,
      )
      .whereIn(
        `${MetaTable.USERS}.id`,
        ncMeta
          .knex(MetaTable.FOLLOWER)
          .select('fk_follower_id')
          .where('fk_user_id', userId),
      );

    let users = await qb;

    users = users.map((user) => {
      user.meta = parseMetaProp(user);
      return user;
    });

    return users;
  }

  static async createFollower(
    {
      fk_user_id,
      fk_follower_id,
    }: {
      fk_user_id: string;
      fk_follower_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (!fk_user_id) NcError.badRequest('fk_user_id is required');
    if (!fk_follower_id) NcError.badRequest('fk_follower_id is required');
    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.FOLLOWER,
      {
        fk_user_id,
        fk_follower_id,
      },
      true,
    );
    return this.getFollower({ fk_user_id, fk_follower_id }, ncMeta);
  }

  static async isFollowing(
    {
      fk_user_id,
      fk_follower_id,
    }: {
      fk_user_id: string;
      fk_follower_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (!fk_user_id) NcError.badRequest('fk_user_id is required');
    if (!fk_follower_id) NcError.badRequest('fk_follower_id is required');
    return await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.FOLLOWER,
      {
        fk_user_id,
        fk_follower_id,
      },
    );
  }

  // TODO: cache
  static async deleteFollower(
    {
      fk_user_id,
      fk_follower_id,
    }: {
      fk_user_id: string;
      fk_follower_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (!fk_user_id) NcError.badRequest('fk_user_id is required');
    if (!fk_follower_id) NcError.badRequest('fk_follower_id is required');

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.FOLLOWER,
      {
        fk_user_id,
        fk_follower_id,
      },
    );
  }

  static async getWithRoles(
    context: NcContext,
    userId: string,
    args: {
      user?: User;
      baseId?: string;
      workspaceId?: string;
      orgId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const user = args.user ?? (await this.get(userId, ncMeta));

    if (!user) NcError.userNotFound(userId);

    const [workspaceRoles, baseRoles, orgRoles] = await Promise.all([
      // extract workspace evel roles
      new Promise((resolve) => {
        if (args.workspaceId ?? context.workspace_id) {
          // todo: cache
          // extract workspace role
          WorkspaceUser.get(
            args.workspaceId ?? context.workspace_id,
            user.id,
            ncMeta,
          )
            .then((workspaceUser) => {
              if (workspaceUser?.roles) {
                resolve(extractRolesObj(workspaceUser.roles));
              } else {
                resolve(null);
              }
            })
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      }) as Promise<ReturnType<typeof extractRolesObj> | null>,
      // extract base level roles
      new Promise((resolve) => {
        if (args.baseId) {
          BaseUser.get(context, args.baseId, user.id, ncMeta)
            .then(async (baseUser) => {
              const roles = baseUser?.roles;
              // + (user.roles ? `,${user.roles}` : '');
              if (roles) {
                resolve(extractRolesObj(roles));
              } else {
                resolve(null);
              }
              // todo: cache
            })
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      }) as Promise<ReturnType<typeof extractRolesObj> | null>,
      // extract org level roles
      new Promise((resolve) => {
        if (args.orgId) {
          OrgUser.get(args.orgId, user.id, ncMeta)
            .then(async (orgUser) => {
              const roles = orgUser?.roles;
              if (roles) {
                resolve(extractRolesObj(roles));
              } else {
                resolve(null);
              }
              // todo: cache
            })
            .catch((_e) => {
              resolve(null);
            });
        } else {
          resolve(null);
        }
      }) as Promise<ReturnType<typeof extractRolesObj> | null>,
    ]);

    return {
      ...sanitiseUserObj(user),
      roles: user.roles ? extractRolesObj(user.roles) : null,
      workspace_roles: workspaceRoles ? workspaceRoles : null,
      base_roles: baseRoles
        ? baseRoles
        : mapWorkspaceRolesObjToProjectRolesObj(workspaceRoles),
      org_roles: orgRoles ? orgRoles : null,
    } as any;
  }

  protected static async clearCache(userId: string, ncMeta = Noco.ncMeta) {
    const user = await this.get(userId, ncMeta);
    if (!user) NcError.userNotFound(userId);

    const bases = await BaseUser.getProjectsList(userId, {}, ncMeta);

    const workspaces = [];

    for (const base of bases) {
      // clear base user list caches
      await NocoCache.deepDel(
        `${CacheScope.BASE_USER}:${base.id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );

      // clear workspace user list caches
      if (
        base['fk_workspace_id'] &&
        !workspaces.includes(base['fk_workspace_id'])
      ) {
        workspaces.push(base['fk_workspace_id']);
        await NocoCache.deepDel(
          `${CacheScope.WORKSPACE_USER}:${base['fk_workspace_id']}:list`,
          CacheDelDirection.PARENT_TO_CHILD,
        );
      }
    }

    // clear all user related cache
    await NocoCache.deepDel(
      `${CacheScope.USER}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.deepDel(
      `${CacheScope.USER}:${user.email}`,
      CacheDelDirection.CHILD_TO_PARENT,
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
        email: `deleted_${user.id}`,
        display_name: `Anonymous`,
        deleted_at: ncMeta.knex.fn.now(),
        is_deleted: true,
      },
      userId,
    );

    await this.clearCache(userId, ncMeta);
  }
}
