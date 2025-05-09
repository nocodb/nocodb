import { IconType, ProjectRoles } from 'nocodb-sdk';
import { User } from 'src/models';
import { Logger } from '@nestjs/common';
import type { WorkspaceUserRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Base from '~/models/Base';
import { cleanCommandPaletteCacheForUser } from '~/helpers/commandPaletteHelpers';
import { PresignedUrl } from '~/models';
import { parseMetaProp } from '~/utils/modelUtils';
import { checkIfWorkspaceSSOAvail } from '~/helpers/paymentHelpers';

const logger = new Logger('WorkspaceUser');

export default class WorkspaceUser {
  fk_workspace_id: string;
  fk_user_id: string;
  roles?: string;
  invite_token?: string;
  invite_accepted?: boolean;
  order?: number;
  deleted?: boolean;
  deleted_at?: string;
  invited_by?: string;

  constructor(data: WorkspaceUser) {
    Object.assign(this, data);
  }

  public static async insert(
    workspaceUser: Partial<
      WorkspaceUser & { created_at?: any; updated_at?: any }
    >,
    ncMeta = Noco.ncMeta,
  ) {
    const { fk_workspace_id, fk_user_id } = workspaceUser;

    const ncMetaTrans = await ncMeta.startTransaction();

    try {
      const wsUser = await ncMetaTrans.metaGet2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE_USER,
        {
          fk_user_id,
          fk_workspace_id,
        },
      );

      if (wsUser) {
        if (wsUser.deleted) {
          await this.delete(fk_workspace_id, fk_user_id, ncMetaTrans);
        } else {
          throw new Error('User already exists in workspace');
        }
      }

      workspaceUser.order =
        workspaceUser.order ??
        (await ncMetaTrans.metaGetNextOrder(MetaTable.WORKSPACE_USER, {
          fk_user_id: workspaceUser.fk_user_id,
        }));

      const insertObj = extractProps(workspaceUser, [
        'fk_user_id',
        'fk_workspace_id',
        'roles',
        'created_at',
        'updated_at',
        'order',
        'invited_by',
        'deleted',
        'deleted_at',
      ]);

      await ncMetaTrans.metaInsert2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE_USER,
        insertObj,
        true,
      );

      await NocoCache.del(
        `${CacheScope.WORKSPACE}:${workspaceUser.fk_workspace_id}:userCount`,
      );

      await NocoCache.del(
        `${CacheScope.RESOURCE_STATS}:workspace:${workspaceUser.fk_workspace_id}`,
      );

      // clear base user list caches
      const bases = await Base.listByWorkspace(
        workspaceUser.fk_workspace_id,
        false,
        ncMetaTrans,
      );
      for (const base of bases) {
        await NocoCache.del(`${CacheScope.BASE_USER}:${base.id}:list`);
      }

      const res = await this.get(fk_workspace_id, fk_user_id, ncMetaTrans);

      // add to workspace user list cache
      await NocoCache.appendToList(
        CacheScope.WORKSPACE_USER,
        [fk_workspace_id],
        `${CacheScope.WORKSPACE_USER}:${fk_workspace_id}:${fk_user_id}`,
      );

      await ncMetaTrans.commit();

      return res;
    } catch (e) {
      await ncMetaTrans.rollback();
      throw e;
    }
  }

  static async get(workspaceId: string, userId: string, ncMeta = Noco.ncMeta) {
    let workspaceUser =
      workspaceId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!workspaceUser) {
      workspaceUser = await ncMeta.metaGet2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE_USER,
        {
          fk_user_id: userId,
          fk_workspace_id: workspaceId,
        },
      );
      if (workspaceUser) {
        const user = await User.get(userId, ncMeta);

        if (user) {
          const { id, email, display_name, roles: main_roles, meta } = user;

          workspaceUser = {
            ...workspaceUser,
            id,
            email,
            display_name,
            main_roles,
            meta,
          };

          await NocoCache.set(
            `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
            workspaceUser,
          );
        }
      }
    }

    if (workspaceUser?.deleted) {
      workspaceUser = null;
    }

    await PresignedUrl.signMetaIconImage(workspaceUser);

    return workspaceUser && new WorkspaceUser(workspaceUser);
  }

  static async workspaceList(
    {
      fk_user_id,
      fk_org_id,
      fk_workspace_id,
    }: { fk_user_id: any; fk_org_id?: string; fk_workspace_id?: string },
    ncMeta = Noco.ncMeta,
  ) {
    // todo: caching

    const queryBuilder = ncMeta
      .knex(MetaTable.WORKSPACE)
      .select(
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.description`,
        `${MetaTable.WORKSPACE}.meta`,
        `${MetaTable.WORKSPACE}.fk_user_id`,
        `${MetaTable.WORKSPACE}.deleted`,
        `${MetaTable.WORKSPACE}.deleted_at`,
        `${MetaTable.WORKSPACE}.status`,
        `${MetaTable.WORKSPACE}.message`,
        `${MetaTable.WORKSPACE}.plan`,
        `${MetaTable.WORKSPACE_USER}.order`,
        `${MetaTable.WORKSPACE_USER}.invite_token`,
        `${MetaTable.WORKSPACE_USER}.invite_accepted`,
        `${MetaTable.WORKSPACE_USER}.roles as roles`,
      )
      .where(`${MetaTable.WORKSPACE}.deleted`, false)
      .whereNotNull(`${MetaTable.WORKSPACE_USER}.roles`);

    // get sso client count
    queryBuilder.select(
      ncMeta
        .knex(MetaTable.SSO_CLIENT)
        .countDistinct(`${MetaTable.SSO_CLIENT}.id`)
        .whereRaw(
          `${MetaTable.SSO_CLIENT}.fk_workspace_id = ${MetaTable.WORKSPACE}.id`,
        )
        .as('sso_client_count'),
    );

    if (fk_org_id) {
      queryBuilder.where(`${MetaTable.WORKSPACE}.fk_org_id`, fk_org_id);
    }

    // Todo: decide the behavior with team
    if (fk_workspace_id) {
      queryBuilder.where(`${MetaTable.WORKSPACE}.id`, fk_workspace_id);
    }

    // todo : pagination
    // .offset(offset)
    // .limit(limit);

    // todo : search
    // if (query) {
    //   queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    // }

    queryBuilder.leftJoin(MetaTable.WORKSPACE_USER, function () {
      this.on(
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        '=',
        `${MetaTable.WORKSPACE}.id`,
      ).andOn(
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        '=',
        ncMeta.knex.raw('?', [fk_user_id]),
      );
    });

    queryBuilder.where(function () {
      this.where(
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        '=',
        ncMeta.knex.raw('?', [fk_user_id]),
      );

      this.orWhereIn(
        `${MetaTable.WORKSPACE}.id`,
        ncMeta
          .knex(MetaTable.PROJECT)
          .select(`${MetaTable.PROJECT}.fk_workspace_id`)
          .innerJoin(MetaTable.PROJECT_USERS, function () {
            this.on(
              `${MetaTable.PROJECT_USERS}.base_id`,
              '=',
              `${MetaTable.PROJECT}.id`,
            ).andOn(
              `${MetaTable.PROJECT_USERS}.fk_user_id`,
              '=',
              ncMeta.knex.raw('?', [fk_user_id]),
            );
          })
          .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.NO_ACCESS),
      );
    });

    queryBuilder.orderBy(`${MetaTable.WORKSPACE_USER}.order`, 'asc');

    let workspaceList = await queryBuilder;

    // parse meta json
    for (const workspace of workspaceList) {
      try {
        workspace.meta =
          typeof workspace.meta === 'string'
            ? JSON.parse(workspace.meta)
            : workspace.meta;
      } catch {
        workspace.meta = {};
      }
    }

    workspaceList = await Promise.all(
      workspaceList.map(async (workspace) => {
        if (
          (workspace.meta as Record<string, any>)?.icon &&
          (workspace.meta as Record<string, any>)?.iconType === IconType.IMAGE
        ) {
          await PresignedUrl.signAttachment(
            {
              attachment: (workspace.meta as Record<string, any>)?.icon,
            },
            Noco.ncMeta,
          );
        }

        // workspace associated with sso client, check if sso enabled for it
        const ssoClientCount = parseInt(workspace.sso_client_count);
        if (ssoClientCount) {
          workspace.sso_only_access = await checkIfWorkspaceSSOAvail(
            workspace,
            false,
          );
        } else {
          workspace.sso_only_access = false;
        }

        return workspace;
      }),
    );

    return workspaceList;
  }

  static async userList(
    {
      fk_workspace_id,
      include_deleted = false,
      roles,
    }: {
      fk_workspace_id: any;
      include_deleted?: boolean;
      roles?: WorkspaceUserRoles;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.WORKSPACE_USER, [
      fk_workspace_id,
    ]);
    let { list: workspaceUsers } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !workspaceUsers.length) {
      const queryBuilder = ncMeta.knex(MetaTable.USERS).select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        // `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.WORKSPACE_USER}.*`,
      );

      queryBuilder.innerJoin(MetaTable.WORKSPACE_USER, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          '=',
          ncMeta.knex.raw('?', [fk_workspace_id]),
        );
      });

      workspaceUsers = await queryBuilder;

      workspaceUsers = workspaceUsers.map((workspaceUser) => {
        workspaceUser.meta = parseMetaProp(workspaceUser);
        return workspaceUser;
      });

      await NocoCache.setList(
        CacheScope.WORKSPACE_USER,
        [fk_workspace_id],
        workspaceUsers,
        ['fk_workspace_id', 'id'],
      );
    }

    if (!include_deleted) {
      workspaceUsers = workspaceUsers.filter(
        (workspaceUser) => !workspaceUser.deleted,
      );
    }

    if (roles) {
      workspaceUsers = workspaceUsers.filter(
        (workspaceUser) => workspaceUser.roles === roles,
      );
    }

    return workspaceUsers;
  }

  static async count(
    {
      workspaceId,
      include_deleted = false,
    }: { workspaceId: any; include_deleted?: boolean },
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.WORKSPACE}:${workspaceId}:userCount`;
    let count = await NocoCache.get(key, CacheGetType.TYPE_STRING);

    if (!count) {
      count = await ncMeta.metaCount(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE_USER,
        {
          xcCondition: {
            _and: [
              {
                fk_workspace_id: {
                  eq: workspaceId,
                },
              },
              ...(include_deleted
                ? []
                : [
                    {
                      _or: [
                        {
                          deleted: {
                            eq: false,
                          },
                        },
                        {
                          deleted: {
                            eq: null,
                          },
                        },
                      ],
                    },
                  ]),
            ],
          },
          aggField: 'fk_user_id',
        },
      );

      await NocoCache.set(key, count);
    } else {
      count = parseInt(count);
    }

    return count;
  }

  static async update(
    workspaceId: any,
    userId: any,
    _updateData: Partial<WorkspaceUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(_updateData, [
      'roles',
      'invite_token',
      'invite_accepted',
      'deleted',
      'deleted_at',
      'order',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      updateObj,
      {
        fk_user_id: userId,
        fk_workspace_id: workspaceId,
      },
    );

    await NocoCache.update(
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      updateObj,
    );

    if (updateObj.roles) {
      // get all bases user is part of and update cache
      const workspaceBases = await Base.listByWorkspace(
        workspaceId,
        true,
        ncMeta,
      );

      for (const base of workspaceBases) {
        await NocoCache.update(`${CacheScope.BASE_USER}:${base.id}:${userId}`, {
          workspace_roles: updateObj.roles,
        });
      }
    }

    await NocoCache.del(
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return this.get(workspaceId, userId, ncMeta);
  }

  static async softDelete(workspaceId: any, userId: any, ncMeta = Noco.ncMeta) {
    const res = await this.update(
      workspaceId,
      userId,
      {
        roles: null,
        deleted: true,
        deleted_at: ncMeta.now(),
      },
      ncMeta,
    );

    await NocoCache.del(`${CacheScope.WORKSPACE}:${workspaceId}:userCount`);
    await NocoCache.del(
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return res;
  }

  static async delete(workspaceId: any, userId: any, ncMeta = Noco.ncMeta) {
    const res = await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        fk_user_id: userId,
        fk_workspace_id: workspaceId,
      },
    );

    // delete cache
    await NocoCache.deepDel(
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.del(`${CacheScope.WORKSPACE}:${workspaceId}:userCount`);
    await NocoCache.del(
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return res;
  }

  static async clearCache(
    workspaceId: any,
    userId: any,
    _ncMeta = Noco.ncMeta,
  ) {
    await NocoCache.deepDel(
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await NocoCache.del(`${CacheScope.WORKSPACE}:${workspaceId}:userCount`);
    await NocoCache.del(
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );
  }

  static async getByToken(
    invitationToken: any,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceUser = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        invite_token: invitationToken,
        fk_user_id: userId,
      },
    );
    return new WorkspaceUser(workspaceUser);
  }
}
