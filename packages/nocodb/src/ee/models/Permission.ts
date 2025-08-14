import {
  PermissionGrantedType,
  type PermissionKey,
  type PermissionRole,
  PermissionRoleMap,
  PermissionRolePower,
  type ProjectRoles,
  type WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { PermissionEntity } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Knex } from 'knex';
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

  subjects?: {
    type: 'user' | 'group';
    id: string;
  }[];

  constructor(permission: Permission) {
    Object.assign(this, permission);
  }

  private static getJsonObjectExpression(
    ncMeta = Noco.ncMeta,
    subjectTypeField: string,
    subjectIdField: string,
  ) {
    const { knex, knexConnection } = ncMeta;
    const client = knexConnection.client.config.client;

    const exprMap = {
      pg: `json_build_object('type', ${subjectTypeField}, 'id', ${subjectIdField})`,
      mysql2: `JSON_OBJECT('type', ${subjectTypeField}, 'id', ${subjectIdField})`,
      sqlite3: `json_object('type', ${subjectTypeField}, 'id', ${subjectIdField})`,
    };

    // fallback to mysql2 query
    return knex.raw(exprMap[client] || exprMap.mysql2);
  }

  private static getJsonArrayAggExpression(
    ncMeta = Noco.ncMeta,
    jsonObjectExpr: Knex.QueryBuilder,
    subjectIdField: string,
  ) {
    const { knex, knexConnection } = ncMeta;
    const client = knexConnection.client.config.client;
    const query = jsonObjectExpr.toQuery();

    const exprMap = {
      pg: `
        COALESCE(
          json_agg(${query}) FILTER (WHERE ${subjectIdField} IS NOT NULL),
          '[]'::json
        )
      `,
      mysql2: `
        COALESCE(
          JSON_ARRAYAGG(
            CASE WHEN ${subjectIdField} IS NOT NULL THEN ${query} END
          ),
          JSON_ARRAY()
        )
      `,
      sqlite3: `
        CASE 
          WHEN COUNT(${subjectIdField}) = 0 
          THEN '[]' 
          ELSE json_group_array(${query})
        END
      `,
    };

    // fallback to mysql2 query
    return knex.raw(exprMap[client] || exprMap.mysql2);
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
      // Use JOIN query to fetch permission with subjects
      const jsonObjectExpr = this.getJsonObjectExpression(
        ncMeta,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_type`,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_id`,
      );

      const jsonArrayAggExpr = this.getJsonArrayAggExpression(
        ncMeta,
        jsonObjectExpr,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_id`,
      );

      const query = ncMeta
        .knexConnection(MetaTable.PERMISSIONS)
        .select([
          `${MetaTable.PERMISSIONS}.*`,
          ncMeta.knex.raw(`${jsonArrayAggExpr.toQuery()} as subjects`),
        ])
        .leftJoin(
          MetaTable.PERMISSION_SUBJECTS,
          `${MetaTable.PERMISSIONS}.id`,
          `${MetaTable.PERMISSION_SUBJECTS}.fk_permission_id`,
        )
        .where(`${MetaTable.PERMISSIONS}.id`, permissionId)
        .where(`${MetaTable.PERMISSIONS}.fk_workspace_id`, context.workspace_id)
        .where(`${MetaTable.PERMISSIONS}.base_id`, context.base_id)
        .groupBy(`${MetaTable.PERMISSIONS}.id`)
        .first();

      permission = await query;

      if (permission) {
        // Subjects are already JSON objects from the aggregation function
        // Ensure subjects is always an array
        if (!permission.subjects || !Array.isArray(permission.subjects)) {
          permission.subjects = [];
        }

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
      // Use single query with JOIN to fetch permissions and subjects
      const jsonObjectExpr = this.getJsonObjectExpression(
        ncMeta,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_type`,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_id`,
      );

      const jsonArrayAggExpr = this.getJsonArrayAggExpression(
        ncMeta,
        jsonObjectExpr,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_id`,
      );

      const query = ncMeta
        .knexConnection(MetaTable.PERMISSIONS)
        .select([
          `${MetaTable.PERMISSIONS}.*`,
          ncMeta.knex.raw(`${jsonArrayAggExpr.toQuery()} as subjects`),
        ])
        .leftJoin(
          MetaTable.PERMISSION_SUBJECTS,
          `${MetaTable.PERMISSIONS}.id`,
          `${MetaTable.PERMISSION_SUBJECTS}.fk_permission_id`,
        )
        .where(`${MetaTable.PERMISSIONS}.fk_workspace_id`, context.workspace_id)
        .where(`${MetaTable.PERMISSIONS}.base_id`, context.base_id)
        .groupBy(`${MetaTable.PERMISSIONS}.id`)
        .orderBy(`${MetaTable.PERMISSIONS}.created_at`, 'asc');

      const permissionsWithSubjects = await query;

      // Ensure subjects is always an array for each permission
      const processedPermissions = permissionsWithSubjects.map((permission) => {
        // Subjects are already JSON objects from the aggregation function
        if (!permission.subjects || !Array.isArray(permission.subjects)) {
          permission.subjects = [];
        }
        return permission;
      });

      await NocoCache.setList(
        CacheScope.PERMISSION,
        [baseId],
        processedPermissions,
      );

      return processedPermissions.map(
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

    // Delete all associated permission subjects first
    await this.removeAllSubjects(context, permissionId, ncMeta);

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

  static async bulkDelete(
    context: NcContext,
    permissionIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!permissionIds.length) return;

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_SUBJECTS,
      null,
      {
        _and: [
          {
            fk_permission_id: {
              in: permissionIds,
            },
          },
        ],
      },
    );

    // Delete all permissions
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSIONS,
      null,
      {
        _and: [
          {
            id: {
              in: permissionIds,
            },
          },
        ],
      },
    );

    // Delete base permissions list cache
    await NocoCache.deepDel(
      `${CacheScope.PERMISSION}:${context.base_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return res;
  }

  public static async setSubjects(
    context: NcContext,
    permissionId: string,
    subjects: { type: 'user' | 'group'; id: string }[],
    ncMeta = Noco.ncMeta,
  ) {
    const permission = await this.get(context, permissionId, ncMeta);

    if (!permission) {
      NcError.genericNotFound('Permission', permissionId);
    }

    // Get existing subjects
    const existingSubjects = permission.subjects || [];

    // Find subjects to add and remove
    const subjectsToAdd = subjects.filter(
      (subject) =>
        !existingSubjects.some(
          (existing) =>
            existing.type === subject.type && existing.id === subject.id,
        ),
    );

    const subjectsToRemove = existingSubjects.filter(
      (existing) =>
        !subjects.some(
          (subject) =>
            subject.type === existing.type && subject.id === existing.id,
        ),
    );

    // Remove subjects that are no longer needed
    if (subjectsToRemove.length > 0) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.PERMISSION_SUBJECTS,
        null,
        {
          _and: [
            { fk_permission_id: { eq: permissionId } },
            {
              _or: subjectsToRemove.map((subject) => ({
                _and: [
                  { subject_type: { eq: subject.type } },
                  { subject_id: { eq: subject.id } },
                ],
              })),
            },
          ],
        },
      );
    }

    // Add new subjects
    if (subjectsToAdd.length > 0) {
      await ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        MetaTable.PERMISSION_SUBJECTS,
        subjectsToAdd.map((subject) => ({
          fk_permission_id: permissionId,
          subject_type: subject.type,
          subject_id: subject.id,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
        })),
        true,
      );
    }

    await NocoCache.update(`${CacheScope.PERMISSION}:${permissionId}`, {
      subjects: subjects,
    });

    return subjects;
  }

  public static async removeAllSubjects(
    context: NcContext,
    permissionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_SUBJECTS,
      {
        fk_permission_id: permissionId,
      },
    );

    await NocoCache.update(`${CacheScope.PERMISSION}:${permissionId}`, {
      subjects: [],
    });

    return res;
  }

  public static async removeSubjectBase(
    context: NcContext,
    subject: { type: 'user' | 'group'; id: string },
    ncMeta = Noco.ncMeta,
  ) {
    // Get all permission subjects for this subject in the workspace
    const subjectPermissions = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_SUBJECTS,
      {
        xcCondition: {
          _and: [
            { subject_type: { eq: subject.type } },
            { subject_id: { eq: subject.id } },
          ],
        },
      },
    );

    if (!subjectPermissions || subjectPermissions.length === 0) {
      return [];
    }

    // Extract unique permission IDs that will be affected
    const affectedPermissionIds = [
      ...new Set(
        subjectPermissions.map(
          (sp: { fk_permission_id: string }) => sp.fk_permission_id,
        ),
      ),
    ];

    // Delete all permission subjects for this subject
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PERMISSION_SUBJECTS,
      null,
      {
        _and: [
          { subject_type: { eq: subject.type } },
          { subject_id: { eq: subject.id } },
        ],
      },
    );

    // Update cache for each affected permission by removing the subject
    for (const permissionId of affectedPermissionIds) {
      const cacheKey = `${CacheScope.PERMISSION}:${permissionId}`;
      const cachedPermission = await NocoCache.get(
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );

      if (cachedPermission && cachedPermission.subjects) {
        // Remove the subject from the cached subjects array
        const updatedSubjects = cachedPermission.subjects.filter(
          (s: { type: 'user' | 'group'; id: string }) =>
            !(s.type === subject.type && s.id === subject.id),
        );

        await NocoCache.update(cacheKey, {
          subjects: updatedSubjects,
        });
      }
    }

    return affectedPermissionIds;
  }

  public static async clearBaseCache(context: NcContext) {
    await NocoCache.deepDel(
      `${CacheScope.PERMISSION}:${context.base_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
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
      // Check if user exists in subjects array
      return (
        permissionObj.subjects?.some(
          (subject) => subject.type === 'user' && subject.id === user.id,
        ) || false
      );
    }

    if (permissionObj.granted_type === PermissionGrantedType.ROLE) {
      const role = PermissionRoleMap[user.role];
      const rolePower = PermissionRolePower[role];

      return rolePower >= PermissionRolePower[permissionObj.granted_role];
    }

    return false;
  }
}
