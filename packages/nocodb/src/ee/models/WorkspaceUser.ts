import { EnterpriseOrgUserRoles, IconType, NcBaseError, ProjectRoles } from 'nocodb-sdk';
import { User } from 'src/models';
import { Logger } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  PrincipalType,
  ResourceType,
  RootScopes,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Base from '~/models/Base';
import { cleanCommandPaletteCacheForUser } from '~/helpers/commandPaletteHelpers';
import { PresignedUrl } from '~/models';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import { checkIfWorkspaceSSOAvail } from '~/helpers/paymentHelpers';
import { clearWorkspaceUserCountCache } from '~/helpers/cacheHelpers';
import { NcError } from '~/helpers/ncError';

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
  // SCIM fields (workspace-specific)
  scim_external_id?: string;
  scim_managed?: boolean;
  scim_user_name?: string;
  scim_meta?: Record<string, any> | string;

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
          NcError._.badRequest('User already exists in workspace');
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
        'scim_external_id',
        'scim_managed',
        'scim_user_name',
        'scim_meta',
      ]);

      // Stringify scim_meta (TEXT column) before insert
      if ('scim_meta' in insertObj) {
        insertObj.scim_meta = stringifyMetaProp(insertObj, 'scim_meta', null);
      }

      await ncMetaTrans.metaInsert2(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.WORKSPACE_USER,
        insertObj,
        true,
      );

      await clearWorkspaceUserCountCache(workspaceUser.fk_workspace_id);

      await NocoCache.del(
        'root',
        `${CacheScope.RESOURCE_STATS}:workspace:${workspaceUser.fk_workspace_id}`,
      );

      // clear base user list caches
      const bases = await Base.listByWorkspace(
        workspaceUser.fk_workspace_id,
        {},
        ncMetaTrans,
      );
      for (const base of bases) {
        await NocoCache.del(
          {
            workspace_id: workspaceUser.fk_workspace_id,
            base_id: base.id,
          },
          `${CacheScope.BASE_USER}:${base.id}:list`,
        );
      }

      const res = await this.get(fk_workspace_id, fk_user_id, {}, ncMetaTrans);

      // add to workspace user list cache
      await NocoCache.appendToList(
        {
          workspace_id: fk_workspace_id,
          base_id: null,
        },
        CacheScope.WORKSPACE_USER,
        [fk_workspace_id],
        `${CacheScope.WORKSPACE_USER}:${fk_workspace_id}:${fk_user_id}`,
      );

      await ncMetaTrans.commit();

      // Ensure user exists in org_users for the workspace's org
      this.ensureOrgUser(fk_workspace_id, fk_user_id, ncMeta).catch((e) => {
        logger.error('Failed to ensure org user', e?.message);
      });

      return res;
    } catch (e) {
      await ncMetaTrans.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      logger.error('Failed to insert workspace User', e);
      NcError._.internalServerError('Failed to add user to  workspace');
    }
  }

  static async get(
    workspaceId: string,
    userId: string,
    {
      include_deleted = false,
    }: {
      include_deleted?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ) {
    let workspaceUser =
      workspaceId &&
      userId &&
      (await NocoCache.get(
        {
          workspace_id: workspaceId,
          base_id: null,
        },
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
            {
              workspace_id: workspaceId,
              base_id: null,
            },
            `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
            workspaceUser,
          );
        }
      }
    }

    if (workspaceUser?.deleted && !include_deleted) {
      workspaceUser = null;
    }

    await PresignedUrl.signMetaIconImage(workspaceUser);

    return workspaceUser && new WorkspaceUser(workspaceUser);
  }

  /**
   * Compute expanded team IDs for a user (direct teams + all descendant teams).
   * Used for hierarchy-aware workspace/base access queries.
   */
  private static async _getExpandedTeamIds(
    fk_user_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    // Step 1: Get all teams the user is a direct member of (with path info)
    const userTeams = await ncMeta
      .knex(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
      .join(`${MetaTable.TEAMS} as t`, 't.id', 'pa.resource_id')
      .where('pa.principal_ref_id', fk_user_id)
      .where('pa.principal_type', PrincipalType.USER)
      .where('pa.resource_type', ResourceType.TEAM)
      .where(function () {
        this.where('pa.deleted', false).orWhereNull('pa.deleted');
      })
      .where(function () {
        this.where('t.deleted', false).orWhereNull('t.deleted');
      })
      .select('t.id', 't.path', 't.fk_workspace_id');

    if (userTeams.length === 0) return [];

    const allTeamIds = new Set<string>();

    // Group teams by workspace for efficient descendant lookup
    const byWorkspace = new Map<string, { id: string; path: string }[]>();
    for (const team of userTeams) {
      allTeamIds.add(team.id);
      if (team.path && team.fk_workspace_id) {
        const list = byWorkspace.get(team.fk_workspace_id) ?? [];
        list.push({ id: team.id, path: team.path });
        byWorkspace.set(team.fk_workspace_id, list);
      }
    }

    // Step 2: For each workspace, fetch all descendants in a single query
    for (const [wsId, teams] of byWorkspace) {
      if (teams.length === 0) continue;

      // Build OR conditions: path LIKE 'ancestor_path/%'
      const descendants = await ncMeta
        .knex(MetaTable.TEAMS)
        .where('fk_workspace_id', wsId)
        .where(function () {
          this.where('deleted', false).orWhereNull('deleted');
        })
        .where(function () {
          for (const team of teams) {
            this.orWhere('path', 'like', `${team.path}/%`);
          }
        })
        .select('id');

      for (const d of descendants) {
        allTeamIds.add(d.id);
      }
    }

    return [...allTeamIds];
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

    // Compute expanded team IDs for hierarchy support.
    // "Expanded" = user's direct teams + all their descendant teams.
    // This enables upward cascade: if Engineering is a parent of Frontend, and
    // Frontend is assigned to a workspace, Engineering members also see it.
    const expandedTeamIds = await WorkspaceUser._getExpandedTeamIds(
      fk_user_id,
      ncMeta,
    );

    const queryBuilder = ncMeta
      .knex(MetaTable.WORKSPACE)
      .select(
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.description`,
        `${MetaTable.WORKSPACE}.meta`,
        `${MetaTable.WORKSPACE}.fk_user_id`,
        `${MetaTable.WORKSPACE}.fk_org_id`,
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
      .where(`${MetaTable.WORKSPACE}.deleted`, false);
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
      this.where(function () {
        this.where(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          ncMeta.knex.raw('?', [fk_user_id]),
        )
          .whereNotNull(`${MetaTable.WORKSPACE_USER}.roles`)
          .whereNotIn(`${MetaTable.WORKSPACE_USER}.roles`, [
            // if direct workspace role is set, it should not be NO_ACCESS or INHERIT
            WorkspaceUserRoles.NO_ACCESS,
            WorkspaceUserRoles.INHERIT,
          ]);
      });

      // Workspace access through team role - only if direct workspace role is null or INHERIT
      // Uses expanded team IDs (direct + descendant teams) for hierarchy support.
      if (expandedTeamIds.length > 0) {
        this.orWhere(function () {
          this.where(function () {
            this.whereNull(`${MetaTable.WORKSPACE_USER}.roles`).orWhere(
              `${MetaTable.WORKSPACE_USER}.roles`,
              '=',
              WorkspaceUserRoles.INHERIT,
            );
          }).whereIn(
            `${MetaTable.WORKSPACE}.id`,
            ncMeta
              .knex(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as wt`)
              .select('wt.resource_id')
              .where('wt.resource_type', ResourceType.WORKSPACE)
              .where('wt.principal_type', PrincipalType.TEAM)
              .whereIn('wt.principal_ref_id', expandedTeamIds)
              .where(function () {
                this.where('wt.deleted', false).orWhereNull('wt.deleted');
              })
              .whereNotNull('wt.roles')
              .whereNot('wt.roles', WorkspaceUserRoles.NO_ACCESS),
          );
        });
      }

      // Workspace access through base membership (direct base user)
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
          .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.NO_ACCESS)
          .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.INHERIT),
      );

      // Workspace access through base-level team assignments
      // Only consider team role if direct base role is null or INHERIT
      // Uses expanded team IDs (direct + descendant teams) for hierarchy support.
      if (expandedTeamIds.length > 0) {
        this.orWhereIn(
          `${MetaTable.WORKSPACE}.id`,
          ncMeta
            .knex(MetaTable.PROJECT)
            .select(`${MetaTable.PROJECT}.fk_workspace_id`)
            .innerJoin(
              `${MetaTable.PRINCIPAL_ASSIGNMENTS} as bt`,
              'bt.resource_id',
              `${MetaTable.PROJECT}.id`,
            )
            .leftJoin(MetaTable.PROJECT_USERS, function () {
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
            .where(function () {
              this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhere(
                `${MetaTable.PROJECT_USERS}.roles`,
                '=',
                ProjectRoles.INHERIT,
              );
            })
            .where('bt.resource_type', ResourceType.BASE)
            .where('bt.principal_type', PrincipalType.TEAM)
            .whereIn('bt.principal_ref_id', expandedTeamIds)
            .where(function () {
              this.where('bt.deleted', false).orWhereNull('bt.deleted');
            })
            .whereNotNull('bt.roles')
            .whereNot('bt.roles', ProjectRoles.NO_ACCESS),
        );
      }
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
    const cachedList = await NocoCache.getList(
      {
        workspace_id: fk_workspace_id,
        base_id: null,
      },
      CacheScope.WORKSPACE_USER,
      [fk_workspace_id],
    );
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
        workspaceUser.scim_meta = parseMetaProp(workspaceUser, 'scim_meta');
        return workspaceUser;
      });

      await NocoCache.setList(
        {
          workspace_id: fk_workspace_id,
          base_id: null,
        },
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
      onlyOwner = false,
    }: {
      workspaceId: any;
      include_deleted?: boolean;
      onlyOwner?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.WORKSPACE}:${workspaceId}:userCount:${include_deleted}:${onlyOwner}`;
    let count = await NocoCache.get(
      {
        workspace_id: workspaceId,
        base_id: null,
      },
      key,
      CacheGetType.TYPE_STRING,
    );

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
              ...(onlyOwner
                ? [{ roles: { eq: WorkspaceUserRoles.OWNER } }]
                : []),
            ],
          },
          aggField: 'fk_user_id',
        },
      );

      await NocoCache.set(
        {
          workspace_id: workspaceId,
          base_id: null,
        },
        key,
        count,
      );
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
      'scim_external_id',
      'scim_managed',
      'scim_user_name',
      'scim_meta',
    ]);

    // Stringify scim_meta (TEXT column) before update
    if ('scim_meta' in updateObj) {
      updateObj.scim_meta = stringifyMetaProp(updateObj, 'scim_meta', null);
    }

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
      {
        workspace_id: workspaceId,
        base_id: null,
      },
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      updateObj,
    );

    if (updateObj.roles) {
      // get all bases user is part of and update cache
      const workspaceBases = await Base.listByWorkspace(
        workspaceId,
        {
          includeDeleted: true,
          includeSnapshot: true,
        },
        ncMeta,
      );

      for (const base of workspaceBases) {
        await NocoCache.update(
          {
            workspace_id: workspaceId,
            base_id: base.id,
          },
          `${CacheScope.BASE_USER}:${base.id}:${userId}`,
          {
            workspace_roles: updateObj.roles,
          },
        );
      }
    }

    await NocoCache.del(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );

    await clearWorkspaceUserCountCache(workspaceId);

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return this.get(workspaceId, userId, {}, ncMeta);
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

    await clearWorkspaceUserCountCache(workspaceId);
    await NocoCache.del(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return res;
  }

  private static async delete(
    workspaceId: any,
    userId: any,
    ncMeta = Noco.ncMeta,
  ) {
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
      {
        workspace_id: workspaceId,
        base_id: null,
      },
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await clearWorkspaceUserCountCache(workspaceId);
    await NocoCache.del(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${workspaceId}`,
    );

    cleanCommandPaletteCacheForUser(userId).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    return res;
  }

  static async softDeleteByUser(userId: string, ncMeta = Noco.ncMeta) {
    // Find all non-deleted workspace memberships for this user
    const entries = await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_user_id', userId)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('fk_workspace_id');

    // Soft-delete each workspace membership and clear all related caches
    for (const entry of entries) {
      await this.softDelete(entry.fk_workspace_id, userId, ncMeta);

      // Clear the workspace user list cache so the deleted entry
      // is not served from stale cache
      await NocoCache.deepDel(
        { workspace_id: entry.fk_workspace_id, base_id: null },
        `${CacheScope.WORKSPACE_USER}:${entry.fk_workspace_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );

      // Clear base user list caches for all bases in this workspace
      // because base member lists include workspace-level members
      const bases = await Base.listByWorkspace(
        entry.fk_workspace_id,
        {},
        ncMeta,
      );
      for (const base of bases) {
        await NocoCache.deepDel(
          { workspace_id: entry.fk_workspace_id, base_id: base.id },
          `${CacheScope.BASE_USER}:${base.id}:list`,
          CacheDelDirection.PARENT_TO_CHILD,
        );
      }
    }
  }

  static async clearBaseUserCacheForWorkspace(..._args: any[]) {}

  static async clearCache(
    workspaceId: any,
    userId: any,
    _ncMeta = Noco.ncMeta,
  ) {
    await NocoCache.deepDel(
      { workspace_id: workspaceId, base_id: null },
      `${CacheScope.WORKSPACE_USER}:${workspaceId}:${userId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await clearWorkspaceUserCountCache(workspaceId);
    await NocoCache.del(
      'root',
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

  /**
   * Direct DB lookup by SCIM external ID using the indexed column.
   * Avoids loading all workspace users into memory.
   */
  static async getByScimExternalId(
    workspaceId: string,
    scimExternalId: string,
    {
      include_deleted = false,
    }: {
      include_deleted?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<any | null> {
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.WORKSPACE_USER}.*`,
      )
      .innerJoin(MetaTable.WORKSPACE_USER, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          '=',
          ncMeta.knex.raw('?', [workspaceId]),
        );
      })
      .where(`${MetaTable.WORKSPACE_USER}.scim_external_id`, scimExternalId);

    if (!include_deleted) {
      queryBuilder.where(function () {
        this.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE_USER}.deleted`,
        );
      });
    }

    const row = await queryBuilder.first();

    if (!row) return null;

    row.meta = parseMetaProp(row);
    row.scim_meta = parseMetaProp(row, 'scim_meta');

    return row;
  }

  /**
   * SQL-level paginated list for SCIM endpoints.
   * Filters scim_managed=true at the DB level with LIMIT/OFFSET.
   * Returns { list, totalResults } for SCIM ListResponse.
   */
  static async scimList(
    {
      fk_workspace_id,
      include_deleted = false,
      offset = 0,
      limit = 100,
      filterUserName,
      filterExternalId,
      sortBy,
      sortAscending = true,
    }: {
      fk_workspace_id: string;
      include_deleted?: boolean;
      offset?: number;
      limit?: number;
      filterUserName?: string;
      filterExternalId?: string;
      sortBy?: string;
      sortAscending?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<{ list: any[]; totalResults: number }> {
    const baseQuery = () => {
      const qb = ncMeta
        .knex(MetaTable.USERS)
        .innerJoin(MetaTable.WORKSPACE_USER, function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            '=',
            ncMeta.knex.raw('?', [fk_workspace_id]),
          );
        })
        .where(`${MetaTable.WORKSPACE_USER}.scim_managed`, true);

      if (!include_deleted) {
        qb.where(function () {
          this.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
            `${MetaTable.WORKSPACE_USER}.deleted`,
          );
        });
      }

      if (filterUserName) {
        qb.where(function () {
          this.whereRaw(
            `LOWER(${MetaTable.WORKSPACE_USER}.scim_user_name) = ?`,
            [filterUserName.toLowerCase()],
          ).orWhereRaw(`LOWER(${MetaTable.USERS}.email) = ?`, [
            filterUserName.toLowerCase(),
          ]);
        });
      }

      if (filterExternalId) {
        qb.whereRaw(`LOWER(${MetaTable.WORKSPACE_USER}.scim_external_id) = ?`, [
          filterExternalId.toLowerCase(),
        ]);
      }

      return qb;
    };

    // Count query
    const countResult = await baseQuery().count('* as count').first();
    const totalResults = Number(countResult?.count || 0);

    // Data query with pagination and sorting
    const dataQuery = baseQuery()
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.WORKSPACE_USER}.*`,
      )
      .offset(offset)
      .limit(limit);

    // Apply sorting
    if (sortBy) {
      const sortCol =
        sortBy === 'userName'
          ? `${MetaTable.WORKSPACE_USER}.scim_user_name`
          : sortBy === 'displayName'
          ? `${MetaTable.USERS}.display_name`
          : sortBy === 'externalId'
          ? `${MetaTable.WORKSPACE_USER}.scim_external_id`
          : `${MetaTable.WORKSPACE_USER}.scim_user_name`;
      dataQuery.orderBy(sortCol, sortAscending ? 'asc' : 'desc');
    } else {
      dataQuery.orderBy(`${MetaTable.WORKSPACE_USER}.created_at`, 'asc');
    }

    const rows = await dataQuery;

    const list = rows.map((row) => {
      row.meta = parseMetaProp(row);
      row.scim_meta = parseMetaProp(row, 'scim_meta');
      return row;
    });

    return { list, totalResults };
  }

  /**
   * Ensure a user has an entry in nc_org_users for the workspace's org.
   * Called after WorkspaceUser.insert() to keep org membership in sync.
   * Fire-and-forget — failures are logged but don't block the invite.
   */
  public static async ensureOrgUser(
    workspaceId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Find the org for this workspace
    const workspace = await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('id', workspaceId)
      .select('fk_org_id')
      .first();

    const orgId = workspace?.fk_org_id || Noco.ncDefaultOrgId;
    if (!orgId) return;

    // Check if already in org
    const existing = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('fk_user_id', userId)
      .first();

    if (existing) {
      // Reactivate if soft-deleted (user was removed from org, now re-invited to a workspace)
      // Reset to default role — the old role was revoked on removal
      if (existing.deleted) {
        await ncMeta
          .knexConnection(MetaTable.ORG_USERS)
          .where('fk_org_id', orgId)
          .where('fk_user_id', userId)
          .update({
            deleted: false,
            deleted_at: null,
            roles: EnterpriseOrgUserRoles.VIEWER,
          });
      }
      return;
    }

    try {
      await ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .insert({
          fk_org_id: orgId,
          fk_user_id: userId,
          roles: EnterpriseOrgUserRoles.VIEWER,
        });
    } catch {
      // Duplicate from race condition — safe to ignore
    }
  }
}
