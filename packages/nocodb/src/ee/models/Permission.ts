import {
  DOCUMENT_PERMISSION_KEYS,
  isMoreRestrictive,
  parseProp,
  PermissionGrantedType,
  PermissionKey,
  type PermissionRole,
  PermissionRoleMap,
  PermissionRolePower,
  type ProjectRoles,
  type WorkspaceUserRoles,
  getPermissionOptionValue,
  PermissionOptionValue,
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
import { isUserInTeamOrDescendants } from '~/ee/utils/team-subject-matcher';

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
    type: 'user' | 'team';
    id: string;
    hierarchy_scope?: 'self_only' | 'self_and_descendants';
  }[];

  constructor(permission: Permission) {
    Object.assign(this, permission);
  }

  private static getJsonObjectExpression(
    ncMeta = Noco.ncMeta,
    subjectTypeField: string,
    subjectIdField: string,
    hierarchyScopeField: string,
  ) {
    const { knex, knexConnection } = ncMeta;
    const client = knexConnection.client.config.client;

    const exprMap = {
      pg: `json_build_object('type', ${subjectTypeField}, 'id', ${subjectIdField}, 'hierarchy_scope', ${hierarchyScopeField})`,
      mysql2: `JSON_OBJECT('type', ${subjectTypeField}, 'id', ${subjectIdField}, 'hierarchy_scope', ${hierarchyScopeField})`,
      sqlite3: `json_object('type', ${subjectTypeField}, 'id', ${subjectIdField}, 'hierarchy_scope', ${hierarchyScopeField})`,
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
      context,
      `${CacheScope.PERMISSION}:${permissionId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!permission) {
      // Use JOIN query to fetch permission with subjects
      const jsonObjectExpr = this.getJsonObjectExpression(
        ncMeta,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_type`,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_id`,
        `${MetaTable.PERMISSION_SUBJECTS}.hierarchy_scope`,
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
        .groupBy([
          `${MetaTable.PERMISSIONS}.base_id`,
          `${MetaTable.PERMISSIONS}.id`,
        ])
        .first();

      permission = await query;

      if (permission) {
        // Subjects are already JSON objects from the aggregation function
        // Ensure subjects is always an array
        if (!permission.subjects || !Array.isArray(permission.subjects)) {
          permission.subjects = [];
        }

        await NocoCache.set(
          context,
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
    const cachedList = await NocoCache.getList(context, CacheScope.PERMISSION, [
      baseId,
    ]);

    const { list: permissionList } = cachedList;

    if (!cachedList.isNoneList && !permissionList.length) {
      // Use single query with JOIN to fetch permissions and subjects
      const jsonObjectExpr = this.getJsonObjectExpression(
        ncMeta,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_type`,
        `${MetaTable.PERMISSION_SUBJECTS}.subject_id`,
        `${MetaTable.PERMISSION_SUBJECTS}.hierarchy_scope`,
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
        .groupBy([
          `${MetaTable.PERMISSIONS}.base_id`,
          `${MetaTable.PERMISSIONS}.id`,
        ])
        .orderBy(`${MetaTable.PERMISSIONS}.created_at`, 'asc');

      const permissionsWithSubjects = await query;

      // Ensure subjects is always an array for each permission
      const processedPermissions = permissionsWithSubjects.map((permission) => {
        // if json string, parse it
        if (typeof permission.subjects === 'string') {
          permission.subjects = parseProp(permission.subjects, []);
        }

        // Subjects are already JSON objects from the aggregation function
        if (!permission.subjects || !Array.isArray(permission.subjects)) {
          permission.subjects = [];
        }
        return permission;
      });

      await NocoCache.setList(
        context,
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
        context,
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
      context,
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
      context,
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
      context,
      `${CacheScope.PERMISSION}:${context.base_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return res;
  }

  public static async setSubjects(
    context: NcContext,
    permissionId: string,
    subjects: { type: 'user' | 'team'; id: string; hierarchy_scope?: string }[],
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

    // Find subjects to update (exist but hierarchy_scope changed)
    const subjectsToUpdate = subjects.filter((subject) =>
      existingSubjects.some(
        (existing) =>
          existing.type === subject.type &&
          existing.id === subject.id &&
          existing.hierarchy_scope !== subject.hierarchy_scope,
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
          hierarchy_scope: subject.hierarchy_scope || null,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
        })),
        true,
      );
    }

    // Update existing subjects where hierarchy_scope changed
    for (const subject of subjectsToUpdate) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.PERMISSION_SUBJECTS,
        { hierarchy_scope: subject.hierarchy_scope || null },
        {
          fk_permission_id: permissionId,
          subject_type: subject.type,
          subject_id: subject.id,
        },
      );
    }

    await NocoCache.update(
      context,
      `${CacheScope.PERMISSION}:${permissionId}`,
      {
        subjects: subjects,
      },
    );

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

    await NocoCache.update(
      context,
      `${CacheScope.PERMISSION}:${permissionId}`,
      {
        subjects: [],
      },
    );

    return res;
  }

  public static async removeSubjectBase(
    context: NcContext,
    subject: { type: 'user' | 'team'; id: string },
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
        context,
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );

      if (cachedPermission && cachedPermission.subjects) {
        // Remove the subject from the cached subjects array
        const updatedSubjects = cachedPermission.subjects.filter(
          (s: { type: 'user' | 'team'; id: string }) =>
            !(s.type === subject.type && s.id === subject.id),
        );

        await NocoCache.update(context, cacheKey, {
          subjects: updatedSubjects,
        });
      }
    }

    return affectedPermissionIds;
  }

  public static async clearBaseCache(context: NcContext) {
    await NocoCache.deepDel(
      context,
      `${CacheScope.PERMISSION}:${context.base_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
  }

  /**
   * Resolve the effective permission for a document by walking up the parent chain.
   * If the document has an explicit permission, return it.
   * Otherwise, inherit from the nearest ancestor that has one.
   * If no ancestor has a permission, return the default.
   */
  /** Maximum ancestor depth to walk before aborting (guards against cycles). */
  private static MAX_DOC_DEPTH = 50;

  static async getEffectiveDocPermission(
    context: NcContext,
    docId: string,
    permissionKey: PermissionKey,
    ncMeta = Noco.ncMeta,
    _depth = 0,
  ): Promise<{ permission: Permission | null; inherited: boolean }> {
    if (_depth > this.MAX_DOC_DEPTH) {
      // Likely a parent_id cycle — bail out with default rather than crash
      return { permission: null, inherited: true };
    }

    // Check if this document has an explicit permission
    const explicit = await this.getByEntity(
      context,
      'document' as PermissionEntity,
      docId,
      permissionKey,
      ncMeta,
    );

    if (explicit) {
      return { permission: explicit, inherited: false };
    }

    // Walk up parent chain — lazy-import Document to break circular dependency
    const Document = await this.getDocumentModel();
    const doc = await Document.get(context, docId, ncMeta);

    if (doc?.parent_id) {
      return this.getEffectiveDocPermission(
        context,
        doc.parent_id,
        permissionKey,
        ncMeta,
        _depth + 1,
      );
    }

    // Root document with no explicit permission → default
    return { permission: null, inherited: true };
  }

  /**
   * Lazy-load and cache the Document model to avoid re-evaluating the
   * dynamic import on every call (circular dependency workaround).
   */
  private static _DocumentModel: typeof import('~/ee/models/Document').default;

  private static async getDocumentModel() {
    if (!this._DocumentModel) {
      this._DocumentModel = (await import('~/ee/models/Document')).default;
    }
    return this._DocumentModel;
  }

  /**
   * Validate that a new document permission is not more permissive than
   * the parent's effective permission (restrict-only inheritance).
   *
   * Throws NcError if the child would be more permissive than the parent.
   */
  static async validateDocPermissionRestriction(
    context: NcContext,
    docId: string,
    permissionKey: PermissionKey,
    newOptionValue: PermissionOptionValue,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const Document = await this.getDocumentModel();
    const doc = await Document.get(context, docId, ncMeta);

    if (!doc?.parent_id) {
      // Root document — no parent to restrict against
      return;
    }

    // Get parent's effective permission
    const { permission: parentPerm } = await this.getEffectiveDocPermission(
      context,
      doc.parent_id,
      permissionKey,
      ncMeta,
    );

    if (!parentPerm) {
      // Parent has default (VIEWERS_AND_UP for visibility, EDITORS_AND_UP for edit)
      // Any value is at least as restrictive as the default, so always valid
      return;
    }

    const parentOptionValue = getPermissionOptionValue(
      parentPerm.granted_type,
      parentPerm.granted_role,
    );

    if (!isMoreRestrictive(newOptionValue, parentOptionValue)) {
      NcError.get(context).forbidden(
        'Cannot set a permission that is more permissive than the parent page',
      );
    }
  }

  /**
   * When a parent document's permission is tightened, cascade to children
   * that have explicit permissions which are now more permissive than the parent.
   * Auto-tighten them by removing their explicit permission (reverting to inherited).
   *
   * Collects all IDs to delete first, then batch-deletes in a single call
   * to avoid partial-cleanup on crash.
   */
  static async cascadeTightenDocPermissions(
    context: NcContext,
    docId: string,
    permissionKey: PermissionKey,
    newParentOptionValue: PermissionOptionValue,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const idsToDelete: string[] = [];

    await this._collectTightenIds(
      context,
      docId,
      permissionKey,
      newParentOptionValue,
      idsToDelete,
      ncMeta,
    );

    if (idsToDelete.length) {
      await this.bulkDelete(context, idsToDelete, ncMeta);
    }
  }

  /**
   * Recursively collect permission IDs that need to be deleted
   * because they are more permissive than the new parent value.
   */
  private static async _collectTightenIds(
    context: NcContext,
    docId: string,
    permissionKey: PermissionKey,
    newParentOptionValue: PermissionOptionValue,
    idsToDelete: string[],
    ncMeta = Noco.ncMeta,
    _depth = 0,
  ): Promise<void> {
    if (_depth > this.MAX_DOC_DEPTH) return;

    const Document = await this.getDocumentModel();

    // Get direct children
    const children = await Document.listLite(context, context.base_id, docId, ncMeta);

    for (const child of children) {
      const childExplicit = await this.getByEntity(
        context,
        'document' as PermissionEntity,
        child.id!,
        permissionKey,
        ncMeta,
      );

      if (childExplicit) {
        const childOptionValue = getPermissionOptionValue(
          childExplicit.granted_type,
          childExplicit.granted_role,
        );

        // If child is now more permissive than parent, mark for deletion
        if (!isMoreRestrictive(childOptionValue, newParentOptionValue)) {
          idsToDelete.push(childExplicit.id);
        }
      }

      // Recurse into children (they may have explicit permissions too)
      if (child.has_children) {
        await this._collectTightenIds(
          context,
          child.id!,
          permissionKey,
          newParentOptionValue,
          idsToDelete,
          ncMeta,
          _depth + 1,
        );
      }
    }
  }

  static async isAllowed(
    context: NcContext,
    permissionObj: Permission,
    user: {
      id: string;
      role: ProjectRoles | WorkspaceUserRoles;
    },
  ): Promise<boolean> {
    if (!permissionObj || (!user.id && !user.role)) {
      return true;
    }

    if (permissionObj.granted_type === PermissionGrantedType.USER) {
      // Check if user exists in subjects array
      const isUserSubject = permissionObj.subjects?.some(
        (subject) => subject.type === 'user' && subject.id === user.id,
      );

      if (isUserSubject) {
        return true;
      }

      // Check if user is a member of any team in subjects (with descendant expansion)
      if (permissionObj.subjects) {
        const teamSubjects = permissionObj.subjects.filter(
          (subject) => subject.type === 'team',
        );

        if (teamSubjects.length > 0) {
          for (const teamSubject of teamSubjects) {
            const matched = await isUserInTeamOrDescendants(
              context,
              user.id,
              teamSubject.id,
              teamSubject.hierarchy_scope,
            );

            if (matched) {
              return true;
            }
          }
        }
      }

      return false;
    }

    if (permissionObj.granted_type === PermissionGrantedType.ROLE) {
      const role = PermissionRoleMap[user.role];
      const rolePower = PermissionRolePower[role];

      return rolePower >= PermissionRolePower[permissionObj.granted_role];
    }

    return false;
  }
}
