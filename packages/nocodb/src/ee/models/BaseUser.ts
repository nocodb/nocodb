import {
  NOCO_SERVICE_USERS,
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
  ProjectRoles,
} from 'nocodb-sdk';
import { BaseUser as BaseUserCE } from 'src/models';
import { Logger } from '@nestjs/common';
import { WorkspaceRolesV3Type } from 'nocodb-sdk';
import type { BaseType, UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/ncError';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  PrincipalType,
  ResourceType,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp } from '~/utils/modelUtils';
import Base from '~/models/Base';
import { extractProps } from '~/helpers/extractProps';
import WorkspaceUser from '~/models/WorkspaceUser';
import { cleanCommandPaletteCacheForUser } from '~/helpers/commandPaletteHelpers';
import { cleanBaseSchemaCacheForBase } from '~/helpers/scriptHelper';
import { getArrayAggExpression } from '~/helpers/dbHelpers';

const logger = new Logger('BaseUser');

export default class BaseUser extends BaseUserCE {
  protected static castType(baseUser: BaseUser): BaseUser {
    return baseUser && new BaseUser(baseUser);
  }

  public static async bulkInsert(
    context: NcContext,
    baseUsers: Partial<BaseUser>[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = [];
    for (const baseUser of baseUsers) {
      const tempObj = extractProps(baseUser, [
        'fk_user_id',
        'base_id',
        'roles',
      ]);
      insertObj.push(tempObj);
    }

    if (!insertObj.length) {
      return;
    }

    const bulkData = await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    const uniqueFks: string[] = [
      ...new Set(bulkData.map((d) => d.base_id)),
    ] as string[];

    for (const fk of uniqueFks) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.BASE_USER}:${fk}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const d of bulkData) {
      await NocoCache.set(
        context,
        `${CacheScope.BASE_USER}:${d.base_id}:${d.fk_user_id}`,
        d,
      );

      await NocoCache.appendToList(
        context,
        CacheScope.BASE_USER,
        [d.base_id],
        `${CacheScope.BASE_USER}:${d.base_id}:${d.fk_user_id}`,
      );

      cleanCommandPaletteCacheForUser(d.fk_user_id).catch(() => {
        logger.error('Error cleaning command palette cache');
      });

      cleanBaseSchemaCacheForBase(context.base_id).catch(() => {
        logger.error('Failed to clean base schema cache');
      });
    }
  }

  public static async insert(
    context: NcContext,
    baseUser: Partial<BaseUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await Base.get(context, baseUser.base_id, ncMeta);
    const workspace_id = base.fk_workspace_id;

    const wsUser = await WorkspaceUser.get(
      workspace_id,
      baseUser.fk_user_id,
      ncMeta,
    );

    if (!wsUser) {
      NcError.get(context).baseUserError('User is not part of workspace');
    }

    const insertObj = extractProps(baseUser, [
      'fk_user_id',
      'base_id',
      'roles',
      'starred',
      'order',
      'hidden',
    ]);

    const { base_id, fk_user_id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT_USERS,
      insertObj,
      true,
    );

    const res = await this.get(context, base_id, fk_user_id, ncMeta);

    await NocoCache.appendToList(
      context,
      CacheScope.BASE_USER,
      [base_id],
      `${CacheScope.BASE_USER}:${base_id}:${fk_user_id}`,
    );

    cleanCommandPaletteCacheForUser(fk_user_id).catch(() => {
      logger.error('Error cleaning command palette cache');
    });

    cleanBaseSchemaCacheForBase(context.base_id).catch(() => {
      logger.error('Failed to clean base schema cache');
    });

    return res;
  }

  static async get(
    context: NcContext,
    baseId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BaseUser & { is_mapped?: boolean }> {
    let baseUser =
      baseId &&
      userId &&
      (await NocoCache.get(
        context,
        `${CacheScope.BASE_USER}:${baseId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseUser || !baseUser.roles) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(this.selectBaseUserProps(context, ncMeta));

      queryBuilder
        .innerJoin(MetaTable.WORKSPACE_USER, function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            '=',
            ncMeta.knex.raw('?', [context.workspace_id]),
          );
        })
        .leftJoin(MetaTable.PROJECT_USERS, function () {
          this.on(
            `${MetaTable.PROJECT_USERS}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.PROJECT_USERS}.base_id`,
            '=',
            ncMeta.knex.raw('?', [baseId]),
          );
        });

      queryBuilder.where(`${MetaTable.USERS}.id`, userId);

      baseUser = await queryBuilder.first();

      if (baseUser) {
        baseUser.meta = parseMetaProp(baseUser);

        await NocoCache.set(
          context,
          `${CacheScope.BASE_USER}:${baseId}:${userId}`,
          baseUser,
        );
      }
    }

    // decide if user is mapped to base by checking if base_id is present
    // base_id will be null if base_user entry is not present
    if (baseUser) {
      baseUser.is_mapped = !!baseUser.base_id;
    }

    return this.castType(baseUser);
  }

  public static async getUsersList(
    context: NcContext,
    {
      base_id,
      mode = 'full',
      strict_in_record = false,
      include_ws_deleted = true,
      user_ids,
      include_internal_user = false,
      skipOverridingWorkspaceRoles = false,
      include_team_users = false,
    }: {
      base_id: string;
      mode?: 'full' | 'viewer';
      strict_in_record?: boolean;
      include_ws_deleted?: boolean;
      include_internal_user?: boolean;
      user_ids?: string[];
      /**
       * If true, will not override workspace roles with default role
       * This is useful when fetching users in a record where we want to show
       * the actual workspace roles instead of the default role
       */
      skipOverridingWorkspaceRoles?: boolean;
      /**
       * If true, will include users who are part of workspace or base through teams
       */
      include_team_users?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const base = await Base.get(context, base_id, ncMeta);

    // if base does not exist, return empty list
    if (!base) {
      return [];
    }

    const cachedList = await NocoCache.getList(context, CacheScope.BASE_USER, [
      base_id,
    ]);
    let { list: baseUsers } = cachedList;
    const { isNoneList } = cachedList;

    const fullVersionCols = [
      'invite_token',
      'base_id',
      'workspace_id',
      'deleted',
    ];

    if (strict_in_record || (!isNoneList && !baseUsers.length)) {
      // Create subqueries for workspace and base team roles
      const workspaceTeamRolesSubquery = ncMeta.knexConnection
        .select('pa.principal_ref_id as user_id')
        .select(
          getArrayAggExpression(
            ncMeta.knex,
            ncMeta.knexConnection,
            'wta.roles',
            'workspace_team_roles',
          ),
        )
        .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
        .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as wta`, function () {
          this.on('wta.principal_ref_id', '=', 'pa.resource_id')
            .andOn('wta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
            .andOn(
              'wta.resource_type',
              '=',
              ncMeta.knex.raw('?', ['workspace']),
            )
            .andOn(
              'wta.resource_id',
              '=',
              ncMeta.knex.raw('?', [base.fk_workspace_id]),
            )
            .andOn(
              ncMeta.knex.raw('COALESCE(wta.deleted, FALSE)'),
              '=',
              ncMeta.knex.raw('?', [false]),
            );
        })
        .where('pa.principal_type', '=', 'user')
        .where('pa.resource_type', '=', 'team')
        .where(
          ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
          '=',
          ncMeta.knex.raw('?', [false]),
        )
        .groupBy('pa.principal_ref_id')
        .as('wtr');

      const baseTeamRolesSubquery = ncMeta.knexConnection
        .select('pa.principal_ref_id as user_id')
        .select(
          getArrayAggExpression(
            ncMeta.knex,
            ncMeta.knexConnection,
            'bta.roles',
            'base_team_roles',
          ),
        )
        .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
        .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as bta`, function () {
          this.on('bta.principal_ref_id', '=', 'pa.resource_id')
            .andOn('bta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
            .andOn('bta.resource_type', '=', ncMeta.knex.raw('?', ['base']))
            .andOn('bta.resource_id', '=', ncMeta.knex.raw('?', [base_id]))
            .andOn(
              ncMeta.knex.raw('COALESCE(bta.deleted, FALSE)'),
              '=',
              ncMeta.knex.raw('?', [false]),
            );
        })
        .where('pa.principal_type', '=', 'user')
        .where('pa.resource_type', '=', 'team')
        .where(
          ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
          '=',
          ncMeta.knex.raw('?', [false]),
        )
        .groupBy('pa.principal_ref_id')
        .as('btr');

      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(this.selectBaseUserProps(context, ncMeta))
        .select('wtr.workspace_team_roles')
        .select('btr.base_team_roles');

      const joinClause = strict_in_record ? 'innerJoin' : 'leftJoin';
      queryBuilder
        .innerJoin(MetaTable.WORKSPACE_USER, function () {
          this.on(
            `${MetaTable.WORKSPACE_USER}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
            '=',
            ncMeta.knex.raw('?', [context.workspace_id]),
          );
        })
        [joinClause](MetaTable.PROJECT_USERS, function () {
          this.on(
            `${MetaTable.PROJECT_USERS}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.PROJECT_USERS}.base_id`,
            '=',
            ncMeta.knex.raw('?', [base_id]),
          );
        })
        .leftJoin(
          workspaceTeamRolesSubquery,
          'wtr.user_id',
          `${MetaTable.USERS}.id`,
        )
        .leftJoin(
          baseTeamRolesSubquery,
          'btr.user_id',
          `${MetaTable.USERS}.id`,
        );

      baseUsers = await queryBuilder;

      baseUsers = baseUsers.map((baseUser) => {
        baseUser.base_id = base_id;
        baseUser.meta = parseMetaProp(baseUser);

        // Process team roles - convert to arrays if needed, then extract topmost role
        const workspaceTeamRoles = baseUser.workspace_team_roles;
        const baseTeamRoles = baseUser.base_team_roles;

        // Handle different database return types
        let workspaceTeamRolesArray: string[] = [];
        if (workspaceTeamRoles) {
          if (typeof workspaceTeamRoles === 'string') {
            try {
              workspaceTeamRolesArray = JSON.parse(workspaceTeamRoles);
            } catch {
              workspaceTeamRolesArray = [workspaceTeamRoles];
            }
          } else if (Array.isArray(workspaceTeamRoles)) {
            workspaceTeamRolesArray = workspaceTeamRoles;
          } else {
            workspaceTeamRolesArray = [workspaceTeamRoles];
          }
        }

        let baseTeamRolesArray: string[] = [];
        if (baseTeamRoles) {
          if (typeof baseTeamRoles === 'string') {
            try {
              baseTeamRolesArray = JSON.parse(baseTeamRoles);
            } catch {
              baseTeamRolesArray = [baseTeamRoles];
            }
          } else if (Array.isArray(baseTeamRoles)) {
            baseTeamRolesArray = baseTeamRoles;
          } else {
            baseTeamRolesArray = [baseTeamRoles];
          }
        }

        // Extract topmost role from arrays (keep only the highest priority role)
        const topmostWorkspaceTeamRole = this.getTopmostRole(
          workspaceTeamRolesArray,
          true,
        );
        const topmostBaseTeamRole = this.getTopmostRole(
          baseTeamRolesArray,
          false,
        );

        // Add topmost team roles to user object (single value, not array)
        (baseUser as any).workspace_team_roles = topmostWorkspaceTeamRole;
        (baseUser as any).base_team_roles = topmostBaseTeamRole;

        return this.castType(baseUser);
      });

      if (!strict_in_record) {
        // Cache users with team roles included
        await NocoCache.setList(
          context,
          CacheScope.BASE_USER,
          [base_id],
          baseUsers,
          ['base_id', 'id'],
        );
      }
    } else {
      // If using cached data, initialize missing team roles to null
      // Missing team roles means the user doesn't have any team roles
      for (const user of baseUsers) {
        if ((user as any).workspace_team_roles === undefined) {
          (user as any).workspace_team_roles = null;
        }
        if ((user as any).base_team_roles === undefined) {
          (user as any).base_team_roles = null;
        }
      }
    }

    // Ensure all users have team roles initialized (null if not set)
    // This handles both fresh and cached data
    for (const user of baseUsers) {
      if ((user as any).workspace_team_roles === undefined) {
        (user as any).workspace_team_roles = null;
      }
      if ((user as any).base_team_roles === undefined) {
        (user as any).base_team_roles = null;
      }
    }

    if (include_internal_user) {
      // Add automation user - it can manipulate data in any workspace
      baseUsers.push(
        ...Object.values(NOCO_SERVICE_USERS).map((u: any) => {
          u.deleted = true;
          return u;
        }),
      );
    }

    // If include_team_users is true, fetch users who are part of workspace or base through teams
    if (include_team_users) {
      try {
        const teamUsers = await this.getTeamUsers(context, base_id, ncMeta);

        // Merge team users with existing base users, avoiding duplicates
        const existingUserIds = new Set(baseUsers.map((u) => u.id));
        const newTeamUsers = teamUsers.filter(
          (u) => !existingUserIds.has(u.id),
        );

        // Initialize team roles to null for new team users
        // Team users are already part of workspace, so team roles would be included in main query if they exist
        for (const teamUser of newTeamUsers) {
          (teamUser as any).workspace_team_roles = null;
          (teamUser as any).base_team_roles = null;
        }

        baseUsers.push(...newTeamUsers);
      } catch (error) {
        // If PrincipalAssignment table doesn't exist yet (migration not run), skip team users
        logger.warn(
          'Team users not available - PrincipalAssignment table may not exist yet:',
          error.message,
        );
      }
    }

    // if default_role is present, override workspace roles with the default roles
    if (base.default_role && !skipOverridingWorkspaceRoles) {
      for (const user of baseUsers) {
        // TODO: later return corresponding WorkspaceRole if defaultRole is provided
        //   now we only support `no-access` role(private base)
        user.workspace_roles = WorkspaceRolesV3Type.WorkspaceLevelNoAccess;
      }
    }

    if (!include_ws_deleted) {
      baseUsers = baseUsers.filter((u) => !u.deleted);
    }

    if (user_ids) {
      baseUsers = baseUsers.filter((u) => user_ids.includes(u.id));
    }

    if (mode === 'full') {
      return baseUsers;
    }

    // remove full version props if viewer
    for (const user of baseUsers) {
      for (const prop of fullVersionCols) {
        delete user[prop];
      }
    }

    return baseUsers;
  }

  static async getProjectsList(
    userId: string,
    params: any,
    ncMeta = Noco.ncMeta,
  ): Promise<(BaseType & { project_role: ProjectRoles })[]> {
    // TODO implement CacheScope.USER_BASE
    const qb = ncMeta
      .knex(MetaTable.PROJECT)
      .select(`${MetaTable.PROJECT}.id`)
      .select(`${MetaTable.PROJECT}.title`)
      .select(`${MetaTable.PROJECT}.prefix`)
      .select(`${MetaTable.PROJECT}.status`)
      .select(`${MetaTable.PROJECT}.description`)
      .select(`${MetaTable.PROJECT}.meta`)
      .select(`${MetaTable.PROJECT}.color`)
      .select(`${MetaTable.PROJECT}.is_meta`)
      .select(`${MetaTable.PROJECT}.type`)
      .select(`${MetaTable.PROJECT}.created_at`)
      .select(`${MetaTable.PROJECT}.updated_at`)
      .select(`${MetaTable.PROJECT}.fk_workspace_id`)
      // .select(`${MetaTable.WORKSPACE_USER}.roles as workspace_role`)
      // .select(`${MetaTable.WORKSPACE}.title as workspace_title`)
      .select(`${MetaTable.PROJECT_USERS}.starred`)
      .select(`${MetaTable.PROJECT_USERS}.roles as project_role`)
      .select(`${MetaTable.PROJECT_USERS}.updated_at as last_accessed`)
      .leftJoin(MetaTable.PROJECT_USERS, function () {
        this.on(
          `${MetaTable.PROJECT_USERS}.base_id`,
          `${MetaTable.PROJECT}.id`,
        );
        this.andOn(
          `${MetaTable.PROJECT_USERS}.fk_user_id`,
          ncMeta.knex.raw('?', [userId]),
        );
      })
      .where(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        ncMeta.knex.raw('?', [userId]),
      )
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      })
      .where(function () {
        this.whereNull(`${MetaTable.PROJECT_USERS}.roles`).orWhereNot(
          `${MetaTable.PROJECT_USERS}.roles`,
          ProjectRoles.NO_ACCESS,
        );
      });

    // filter starred bases
    if (params.starred) {
      qb.where(`${MetaTable.PROJECT_USERS}.starred`, true);
    }

    // filter shared with me bases
    if (params.shared) {
      qb.where(function () {
        // include bases belongs project_user in which user is not owner
        this.where(function () {
          this.where(`${MetaTable.PROJECT_USERS}.fk_user_id`, userId)
            .whereNot(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.OWNER)
            .whereNotNull(`${MetaTable.PROJECT_USERS}.roles`);
        });
      });
    }

    // order based on recently accessed
    if (params.recent) {
      qb.orderBy(`${MetaTable.PROJECT_USERS}.updated_at`, 'desc');
    }

    qb.whereNot(`${MetaTable.PROJECT}.deleted`, true);

    const baseList = await qb;
    if (baseList && baseList?.length) {
      return baseList
        .filter((p) => !params?.type || p.type === params.type)
        .sort(
          (a, b) =>
            (a.order != null ? a.order : Infinity) -
            (b.order != null ? b.order : Infinity),
        )
        .map((p) => {
          p.meta = parseMetaProp(p);
          return Base.castType(p);
        });
    } else {
      return [];
    }
  }

  /**
   * Extract the topmost (highest priority) role from an array of roles
   * @param roles - Array of roles (workspace or base team roles)
   * @param isWorkspaceRole - Whether these are workspace roles (true) or base roles (false)
   * @returns The topmost role or null if no valid roles found
   */
  private static getTopmostRole(
    roles: string[] | null | undefined,
    isWorkspaceRole: boolean,
  ): string | null {
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return null;
    }

    // Find the role with the lowest index (highest priority)
    let topmostRole: string | null = null;
    let topmostIndex = Infinity;

    for (const role of roles) {
      if (!role) continue;

      // Use the appropriate ordered roles array based on type
      let index = -1;
      if (isWorkspaceRole) {
        index = OrderedWorkspaceRoles.indexOf(role as any);
      } else {
        index = OrderedProjectRoles.indexOf(role as any);
      }

      if (index !== -1 && index < topmostIndex) {
        topmostIndex = index;
        topmostRole = role;
      }
    }

    return topmostRole;
  }

  static selectBaseUserProps(context: NcContext, ncMeta = Noco.ncMeta) {
    return [
      `${MetaTable.USERS}.id`,
      `${MetaTable.USERS}.email`,
      `${MetaTable.USERS}.display_name`,
      `${MetaTable.USERS}.id as fk_user_id`,
      `${MetaTable.USERS}.invite_token`,
      `${MetaTable.USERS}.roles as main_roles`,
      `${MetaTable.USERS}.meta`,

      ncMeta.knex.raw(
        `COALESCE(${MetaTable.PROJECT_USERS}.created_at, ${MetaTable.WORKSPACE_USER}.created_at) as created_at`,
      ),
      ncMeta.knex.raw(
        `COALESCE(${MetaTable.PROJECT_USERS}.updated_at, ${MetaTable.WORKSPACE_USER}.updated_at) as updated_at`,
      ),

      `${MetaTable.PROJECT_USERS}.base_id`,
      `${MetaTable.PROJECT_USERS}.roles as roles`,
      ...(context.workspace_id
        ? [
            `${MetaTable.WORKSPACE_USER}.roles as workspace_roles`,
            `${MetaTable.WORKSPACE_USER}.fk_workspace_id as workspace_id`,
            `${MetaTable.WORKSPACE_USER}.deleted as deleted`,
          ]
        : []),
    ];
  }

  /**
   * Get team roles map for a list of users
   * @param context - NocoDB context
   * @param workspaceId - Workspace ID
   * @param baseId - Base ID
   * @param userIds - Array of user IDs
   * @param ncMeta - NocoDB meta instance
   * @returns Map of user ID to team roles
   */
  private static async getTeamRolesMap(
    context: NcContext,
    workspaceId: string,
    baseId: string,
    userIds: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<
    Map<string, { workspace_team_roles: string[]; base_team_roles: string[] }>
  > {
    const rolesMap = new Map<
      string,
      { workspace_team_roles: string[]; base_team_roles: string[] }
    >();

    if (userIds.length === 0) {
      return rolesMap;
    }

    try {
      // Get workspace team roles
      const workspaceTeamRoles = await ncMeta.knexConnection
        .select('pa.principal_ref_id as user_id', 'wta.roles')
        .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
        .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as wta`, function () {
          this.on('wta.principal_ref_id', '=', 'pa.resource_id')
            .andOn('wta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
            .andOn(
              'wta.resource_type',
              '=',
              ncMeta.knex.raw('?', ['workspace']),
            )
            .andOn('wta.resource_id', '=', ncMeta.knex.raw('?', [workspaceId]))
            .andOn(
              ncMeta.knex.raw('COALESCE(wta.deleted, FALSE)'),
              '=',
              ncMeta.knex.raw('?', [false]),
            );
        })
        .where('pa.principal_type', '=', 'user')
        .where('pa.resource_type', '=', 'team')
        .whereIn('pa.principal_ref_id', userIds)
        .where(
          ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
          '=',
          ncMeta.knex.raw('?', [false]),
        );

      // Get base team roles
      const baseTeamRoles = await ncMeta.knexConnection
        .select('pa.principal_ref_id as user_id', 'bta.roles')
        .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
        .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as bta`, function () {
          this.on('bta.principal_ref_id', '=', 'pa.resource_id')
            .andOn('bta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
            .andOn('bta.resource_type', '=', ncMeta.knex.raw('?', ['base']))
            .andOn('bta.resource_id', '=', ncMeta.knex.raw('?', [baseId]))
            .andOn(
              ncMeta.knex.raw('COALESCE(bta.deleted, FALSE)'),
              '=',
              ncMeta.knex.raw('?', [false]),
            );
        })
        .where('pa.principal_type', '=', 'user')
        .where('pa.resource_type', '=', 'team')
        .whereIn('pa.principal_ref_id', userIds)
        .where(
          ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
          '=',
          ncMeta.knex.raw('?', [false]),
        );

      // Initialize map with empty arrays
      for (const userId of userIds) {
        rolesMap.set(userId, {
          workspace_team_roles: [],
          base_team_roles: [],
        });
      }

      // Populate workspace team roles
      for (const row of workspaceTeamRoles) {
        const userId = row.user_id;
        const roles = rolesMap.get(userId);
        if (roles && row.roles) {
          if (!roles.workspace_team_roles.includes(row.roles)) {
            roles.workspace_team_roles.push(row.roles);
          }
        }
      }

      // Populate base team roles
      for (const row of baseTeamRoles) {
        const userId = row.user_id;
        const roles = rolesMap.get(userId);
        if (roles && row.roles) {
          if (!roles.base_team_roles.includes(row.roles)) {
            roles.base_team_roles.push(row.roles);
          }
        }
      }
    } catch (error) {
      logger.warn('Error fetching team roles:', error.message);
    }

    return rolesMap;
  }

  /**
   * Get users who are part of workspace or base through teams
   * This includes users from:
   * 1. Teams assigned to the workspace (workspace team users)
   * 2. Teams assigned to the base (base team users)
   * @param context - NocoDB context
   * @param baseId - Base ID
   * @param ncMeta - NocoDB meta instance
   * @returns Promise<BaseUser[]> - Array of team users
   */
  private static async getTeamUsers(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Pick<UserType, 'id' | 'email' | 'meta' | 'display_name'>[]> {
    try {
      const teamUsers: Pick<
        UserType,
        'id' | 'email' | 'meta' | 'display_name'
      >[] = [];

      // Get base to access workspace_id
      const base = await Base.get(context, baseId, ncMeta);
      if (!base) {
        return teamUsers;
      }

      // Simple query: Get users who belong to teams assigned to workspace or base
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select([
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          `${MetaTable.USERS}.id as fk_user_id`,
          `${MetaTable.USERS}.roles as main_roles`,
          `${MetaTable.USERS}.meta`,
        ])
        .distinct();

      // Join with team assignments (user -> team)
      queryBuilder
        .innerJoin(
          `${MetaTable.PRINCIPAL_ASSIGNMENTS} as team_assignments`,
          function () {
            this.on(
              'team_assignments.principal_ref_id',
              '=',
              `${MetaTable.USERS}.id`,
            )
              .andOn(
                'team_assignments.principal_type',
                '=',
                ncMeta.knex.raw('?', [PrincipalType.USER]),
              )
              .andOn(
                'team_assignments.resource_type',
                '=',
                ncMeta.knex.raw('?', [ResourceType.TEAM]),
              );
          },
        )
        // Join with resource assignments (team -> workspace/base)
        .innerJoin(
          `${MetaTable.PRINCIPAL_ASSIGNMENTS} as resource_assignments`,
          function () {
            this.on(
              'resource_assignments.principal_ref_id',
              '=',
              'team_assignments.resource_id',
            ).andOn(
              'resource_assignments.principal_type',
              '=',
              ncMeta.knex.raw('?', [PrincipalType.TEAM]),
            );
          },
        )
        // Filter: teams assigned to workspace OR base
        .where(function () {
          this.where(function () {
            // Teams assigned to workspace
            this.where(
              'resource_assignments.resource_type',
              ResourceType.WORKSPACE,
            ).andWhere(
              'resource_assignments.resource_id',
              base.fk_workspace_id,
            );
          }).orWhere(function () {
            // Teams assigned to base
            this.where(
              'resource_assignments.resource_type',
              ResourceType.BASE,
            ).andWhere('resource_assignments.resource_id', baseId);
          });
        });

      const users = await queryBuilder;

      // Process results and deduplicate by user ID (in case distinct() doesn't work perfectly)
      const seenUserIds = new Set<string>();
      for (const user of users) {
        const userId = user.id || user.fk_user_id;
        if (userId && !seenUserIds.has(userId)) {
          seenUserIds.add(userId);
          teamUsers.push(user);
        }
      }

      return teamUsers;
    } catch (error) {
      logger.error('Error fetching team users:', error);
      return [];
    }
  }
}
