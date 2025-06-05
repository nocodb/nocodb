import {
  type PermissionEntity,
  PermissionGrantedType,
  type PermissionKey,
  type PermissionRole,
  PermissionRoleMap,
  PermissionRolePower,
  type ProjectRoles,
  type WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/ncError';

export default class Permission {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  created_by: string;
  enforce_for_form: boolean;
  enforce_for_automation: boolean;
  granted_type: PermissionGrantedType;
  granted_role: PermissionRole;

  user_ids?: string[];

  constructor(permission: Permission) {
    Object.assign(this, permission);
  }

  public static async get(
    context: NcContext,
    permissionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let permission = await NocoCache.get(
      `${CacheScope.PERMISSION}:${permissionId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!permission) {
      // Use JOIN query to fetch permission with user_ids
      const query = ncMeta
        .knexConnection(MetaTable.PERMISSIONS)
        .select([
          `${MetaTable.PERMISSIONS}.*`,
          ncMeta.knex.raw(
            `JSON_ARRAYAGG(CASE WHEN ${MetaTable.PERMISSION_USERS}.fk_user_id IS NOT NULL THEN ${MetaTable.PERMISSION_USERS}.fk_user_id END) as user_ids`,
          ),
        ])
        .leftJoin(
          MetaTable.PERMISSION_USERS,
          `${MetaTable.PERMISSIONS}.id`,
          `${MetaTable.PERMISSION_USERS}.fk_permission_id`,
        )
        .where(`${MetaTable.PERMISSIONS}.id`, permissionId)
        .where(`${MetaTable.PERMISSIONS}.fk_workspace_id`, context.workspace_id)
        .where(`${MetaTable.PERMISSIONS}.base_id`, context.base_id)
        .groupBy(`${MetaTable.PERMISSIONS}.id`)
        .first();

      permission = await query;

      if (permission) {
        await NocoCache.set(
          `${CacheScope.PERMISSION}:${permissionId}`,
          permission,
        );
      }
    }

    return permission && new Permission(permission);
  }

  public static async getByEntity(
    context: NcContext,
    entity: PermissionEntity,
    entityId: string,
    permission: PermissionKey,
    ncMeta = Noco.ncMeta,
  ) {
    const permissions = await this.list(context, context.base_id, ncMeta);

    const permissionObj = permissions.find(
      (p) =>
        p.entity === entity &&
        p.entity_id === entityId &&
        p.permission === permission,
    );

    return permissionObj && new Permission(permissionObj);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.PERMISSION, [baseId]);

    const { list: permissionList } = cachedList;

    if (!cachedList.isNoneList && !permissionList.length) {
      // Use single query with JOIN to fetch permissions and user_ids
      const query = ncMeta
        .knexConnection(MetaTable.PERMISSIONS)
        .select([
          `${MetaTable.PERMISSIONS}.*`,
          ncMeta.knex.raw(
            `JSON_ARRAYAGG(CASE WHEN ${MetaTable.PERMISSION_USERS}.fk_user_id IS NOT NULL THEN ${MetaTable.PERMISSION_USERS}.fk_user_id END) as user_ids`,
          ),
        ])
        .leftJoin(
          MetaTable.PERMISSION_USERS,
          `${MetaTable.PERMISSIONS}.id`,
          `${MetaTable.PERMISSION_USERS}.fk_permission_id`,
        )
        .where(`${MetaTable.PERMISSIONS}.fk_workspace_id`, context.workspace_id)
        .where(`${MetaTable.PERMISSIONS}.base_id`, context.base_id)
        .groupBy(`${MetaTable.PERMISSIONS}.id`)
        .orderBy(`${MetaTable.PERMISSIONS}.created_at`, 'asc');

      const permissionsWithUserIds = await query;

      await NocoCache.setList(
        CacheScope.PERMISSION,
        [baseId],
        permissionsWithUserIds,
      );
      return permissionsWithUserIds.map(
        (permission) => new Permission(permission),
      );
    }

    return permissionList.map((permission) => new Permission(permission));
  }

  public static async insert(
    context: NcContext,
    permission: Partial<Permission>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(permission, [
      'fk_workspace_id',
      'base_id',
      'entity',
      'entity_id',
      'permission',
      'created_by',
      'enforce_for_form',
      'enforce_for_automation',
      'granted_type',
      'granted_role',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSIONS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        CacheScope.PERMISSION,
        [permission.base_id],
        `${CacheScope.PERMISSION}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    permissionId: string,
    permission: Partial<Permission>,
    ncMeta = Noco.ncMeta,
  ) {
    const permissionObj = await this.get(context, permissionId, ncMeta);

    if (!permissionObj) {
      NcError.genericNotFound('Permission', permissionId);
    }

    const updateObj = extractProps(permission, [
      'enforce_for_form',
      'enforce_for_automation',
      'granted_type',
      'granted_role',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSIONS,
      updateObj,
      permissionId,
    );

    await NocoCache.update(
      `${CacheScope.PERMISSION}:${permissionId}`,
      updateObj,
    );

    return this.get(context, permissionId, ncMeta);
  }

  static async delete(
    context: NcContext,
    permissionId: any,
    ncMeta = Noco.ncMeta,
  ) {
    const permission = await this.get(context, permissionId, ncMeta);

    if (!permission) {
      NcError.genericNotFound('Permission', permissionId);
    }

    // Delete all associated permission users first
    await this.removeAllUsers(context, permissionId, ncMeta);

    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSIONS,
      permissionId,
    );

    await NocoCache.deepDel(
      `${CacheScope.PERMISSION}:${permissionId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  public static async setUsers(
    context: NcContext,
    permissionId: string,
    userIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    const permission = await this.get(context, permissionId, ncMeta);

    if (!permission) {
      NcError.genericNotFound('Permission', permissionId);
    }

    const existingUsers = permission.user_ids;

    const usersToAdd = userIds.filter(
      (userId) => !permission.user_ids?.includes(userId),
    );

    const usersToRemove = existingUsers.filter(
      (userId) => !userIds.includes(userId),
    );

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_USERS,
      null,
      {
        _and: [
          { fk_permission_id: { eq: permissionId } },
          {
            fk_user_id: { in: usersToRemove },
          },
        ],
      },
    );

    await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_USERS,
      usersToAdd.map((userId) => ({
        fk_permission_id: permissionId,
        fk_user_id: userId,
      })),
      true,
    );

    // list of final users (existing + added - removed)
    const finalUsers = [...existingUsers, ...usersToAdd].filter(
      (userId) => !usersToRemove.includes(userId),
    );

    await NocoCache.update(`${CacheScope.PERMISSION}:${permissionId}`, {
      user_ids: finalUsers,
    });

    return finalUsers;
  }

  public static async removeAllUsers(
    context: NcContext,
    permissionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_USERS,
      {
        fk_permission_id: permissionId,
      },
    );

    await NocoCache.update(`${CacheScope.PERMISSION}:${permissionId}`, {
      user_ids: [],
    });

    return res;
  }

  static isAllowed(
    permissionObj: Permission,
    user: {
      id: string;
      role: ProjectRoles | WorkspaceUserRoles;
    },
  ) {
    if (!permissionObj || (!user.id && !user.role)) {
      return true;
    }

    if (permissionObj.granted_type === PermissionGrantedType.USER) {
      return permissionObj.user_ids?.includes(user.id);
    }

    if (permissionObj.granted_type === PermissionGrantedType.ROLE) {
      const role = PermissionRoleMap[user.role];
      const rolePower = PermissionRolePower[role];

      return rolePower >= PermissionRolePower[permissionObj.granted_role];
    }

    return false;
  }
}
