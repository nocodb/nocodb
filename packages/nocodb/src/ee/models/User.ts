import UserCE from 'src/models/User';
import { extractRolesObj, type UserType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { ProjectUser, WorkspaceUser } from '~/models';
import { sanitiseUserObj } from '~/utils';

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
      'refresh_token',
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
      'avatar',
      'display_name',
      'user_name',
      'refresh_token',
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
    await NocoCache.del(`${CacheScope.USER}:${existingUser.email}`);

    // as <projectId> is unknown, delete user:<email>___<projectId> in cache
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

  // TODO: cache
  public static async getByUsername(username: string, ncMeta = Noco.ncMeta) {
    const user = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
      user_name: username,
    });

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

  // TODO: cache
  static async getUserProfile(
    userId,
    ncMeta = Noco.ncMeta,
  ): Promise<Partial<UserType>> {
    const profile = await ncMeta.metaGet2(null, null, MetaTable.USERS, userId, [
      'id',
      'email',
      'avatar',
      'user_name',
      'display_name',
      'bio',
      'location',
      'website',
    ]);
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
    return await ncMeta.metaGet2(null, null, MetaTable.FOLLOWER, {
      fk_user_id,
      fk_follower_id,
    });
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
      )
      .whereIn(
        `${MetaTable.USERS}.id`,
        ncMeta
          .knex(MetaTable.FOLLOWER)
          .select('fk_user_id')
          .where('fk_follower_id', userId),
      );

    return qb;
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

    return qb;
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
      null,
      null,
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
    return await ncMeta.metaGet2(null, null, MetaTable.FOLLOWER, {
      fk_user_id,
      fk_follower_id,
    });
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

    return await ncMeta.metaDelete(null, null, MetaTable.FOLLOWER, {
      fk_user_id,
      fk_follower_id,
    });
  }

  static async getWithRoles(
    userId: string,
    args: {
      user?: User;
      projectId?: string;
      workspaceId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const user = args.user ?? (await this.get(userId, ncMeta));

    if (!user) NcError.badRequest('User not found');

    const [workspaceRoles, projectRoles] = await Promise.all([
      // extract workspace evel roles
      new Promise((resolve) => {
        if (args.workspaceId) {
          // todo: cache
          // extract workspace role
          WorkspaceUser.get(args.workspaceId, user.id)
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
      // extract project level roles
      new Promise((resolve) => {
        if (args.projectId) {
          ProjectUser.get(args.projectId, user.id).then(async (projectUser) => {
            let roles = projectUser?.roles;
            roles = roles === 'owner' ? 'owner,creator' : roles;
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
      }) as Promise<ReturnType<typeof extractRolesObj> | null>,
    ]);

    return {
      ...sanitiseUserObj(user),
      roles: user.roles ? extractRolesObj(user.roles) : null,
      workspace_roles: workspaceRoles ? workspaceRoles : null,
      project_roles: projectRoles ? projectRoles : null,
    } as any;
  }
}
