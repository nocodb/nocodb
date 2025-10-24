import type { NcContext } from '~/interface/config';
import type { PrincipalType, ResourceType } from '~/utils/globals';
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

export default class PrincipalAssignment {
  resource_type: ResourceType; // Uses ResourceType enum
  resource_id: string; // ID of the resource
  principal_type: PrincipalType; // Uses PrincipalType enum
  principal_ref_id: string; // FK to user/team/bot table
  roles: string; // Role(s) assigned
  deleted: boolean; // Soft delete flag
  created_at?: string;
  updated_at?: string;

  constructor(data: PrincipalAssignment) {
    Object.assign(this, data);
  }

  protected static castType(
    assignment: PrincipalAssignment,
  ): PrincipalAssignment {
    return assignment && new PrincipalAssignment(assignment);
  }

  public static async insert(
    context: NcContext,
    assignment: Partial<PrincipalAssignment>,
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment> {
    // Check if a soft-deleted assignment already exists
    const existingAssignment = await ncMeta.metaGet(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        resource_id: assignment.resource_id,
        resource_type: assignment.resource_type,
        principal_type: assignment.principal_type,
        principal_ref_id: assignment.principal_ref_id,
      },
    );

    if (existingAssignment && existingAssignment.deleted) {
      // Restore the soft-deleted assignment
      const updateObj = {
        roles: assignment.roles,
        deleted: false,
      };

      await ncMeta.metaUpdate(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.PRINCIPAL_ASSIGNMENTS,
        updateObj,
        {
          resource_type: assignment.resource_type,
          resource_id: assignment.resource_id,
          principal_type: assignment.principal_type,
          principal_ref_id: assignment.principal_ref_id,
        },
      );

      const restoredAssignment = await ncMeta.metaGet(
        RootScopes.WORKSPACE,
        RootScopes.WORKSPACE,
        MetaTable.PRINCIPAL_ASSIGNMENTS,
        {
          resource_id: assignment.resource_id,
          resource_type: assignment.resource_type,
          principal_type: assignment.principal_type,
          principal_ref_id: assignment.principal_ref_id,
        },
      );

      await NocoCache.set(
        context,
        `${CacheScope.PRINCIPAL_ASSIGNMENT}:${assignment.resource_type}:${assignment.resource_id}:${assignment.principal_type}:${assignment.principal_ref_id}`,
        restoredAssignment,
      );

      // Invalidate count cache for this resource
      const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${assignment.resource_type}:${assignment.resource_id}`;
      await NocoCache.del(context, countCacheKey);

      return this.castType(restoredAssignment);
    }

    // Create new assignment
    const insertObj = extractProps(assignment, [
      'resource_type',
      'resource_id',
      'principal_type',
      'principal_ref_id',
      'roles',
    ]);

    // Set deleted to false by default
    insertObj.deleted = false;

    await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      insertObj,
      true,
    );

    const assignmentData = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        resource_id: insertObj.resource_id,
        resource_type: insertObj.resource_type,
        principal_type: insertObj.principal_type,
        principal_ref_id: insertObj.principal_ref_id,
      },
      undefined,
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
    );

    if (!assignmentData) {
      throw new Error('Failed to retrieve created assignment');
    }

    await NocoCache.set(
      context,
      `${CacheScope.PRINCIPAL_ASSIGNMENT}:${insertObj.resource_type}:${insertObj.resource_id}:${insertObj.principal_type}:${insertObj.principal_ref_id}`,
      assignmentData[0],
    );

    // Invalidate count cache for this resource
    const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${insertObj.resource_type}:${insertObj.resource_id}`;
    await NocoCache.del(context, countCacheKey);

    return this.castType(assignmentData);
  }

  public static async get(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment | null> {
    const assignments = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        condition: {
          resource_type: resourceType,
          resource_id: resourceId,
          principal_type: principalType,
          principal_ref_id: principalRefId,
        },
        xcCondition: {
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
      },
    );

    return assignments.length > 0 ? this.castType(assignments[0]) : null;
  }

  public static async list(
    context: NcContext,
    filter?: {
      resource_type?: ResourceType;
      resource_id?: string;
      principal_type?: PrincipalType;
      principal_ref_id?: string;
      roles?: string;
      deleted?: boolean; // Allow filtering by deleted status
    },
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment[]> {
    const condition = { ...filter };

    // Build xcCondition for soft delete filtering
    let xcCondition: any = {};

    if (filter?.deleted !== undefined) {
      // Explicitly requested deleted status
      if (filter.deleted === true) {
        xcCondition = {
          deleted: {
            eq: true,
          },
        };
      } else {
        xcCondition = {
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
        };
      }
    } else {
      // Default: exclude soft-deleted records
      xcCondition = {
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
      };
    }

    const assignments = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        condition,
        xcCondition,
      },
    );

    return assignments.map((assignment) => this.castType(assignment));
  }

  public static async listByResource(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment[]> {
    return this.list(
      context,
      {
        resource_type: resourceType,
        resource_id: resourceId,
      },
      ncMeta,
    );
  }

  public static async listByPrincipal(
    context: NcContext,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment[]> {
    return this.list(
      context,
      {
        principal_type: principalType,
        principal_ref_id: principalRefId,
      },
      ncMeta,
    );
  }

  public static async countByResource(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    // Try to get from cache first
    const cacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${resourceType}:${resourceId}`;
    const cachedCount = await NocoCache.get(
      context,
      cacheKey,
      CacheGetType.TYPE_STRING,
    );

    if (cachedCount !== null) {
      return parseInt(cachedCount);
    }

    // If not in cache, get from database
    const assignments = await this.listByResource(
      context,
      resourceType,
      resourceId,
      ncMeta,
    );

    const count = assignments.length;

    // Cache the count for 5 minutes
    await NocoCache.setExpiring(context, cacheKey, count.toString(), 300);

    return count;
  }

  public static async countByResourceAndRole(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    role: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const assignments = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        condition: {
          resource_type: resourceType,
          resource_id: resourceId,
          roles: role,
        },
        xcCondition: {
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
      },
    );
    return assignments.length;
  }

  public static async update(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalType: PrincipalType,
    principalRefId: string,
    updateData: Partial<PrincipalAssignment>,
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment> {
    const updateObj = extractProps(updateData, ['roles']);

    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      updateObj,
      {
        resource_type: resourceType,
        resource_id: resourceId,
        principal_type: principalType,
        principal_ref_id: principalRefId,
      },
    );

    const updatedAssignment = await this.get(
      context,
      resourceType,
      resourceId,
      principalType,
      principalRefId,
      ncMeta,
    );

    if (updatedAssignment) {
      await NocoCache.set(
        context,
        `${CacheScope.PRINCIPAL_ASSIGNMENT}:${resourceType}:${resourceId}:${principalType}:${principalRefId}`,
        updatedAssignment,
      );
    }

    // Invalidate count cache for this resource
    const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${resourceType}:${resourceId}`;
    await NocoCache.del(context, countCacheKey);

    return updatedAssignment!;
  }

  public static async softDelete(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      { deleted: true },
      {
        resource_type: resourceType,
        resource_id: resourceId,
        principal_type: principalType,
        principal_ref_id: principalRefId,
      },
    );

    // Clear cache
    await NocoCache.deepDel(
      context,
      `${CacheScope.PRINCIPAL_ASSIGNMENT}:${resourceType}:${resourceId}:${principalType}:${principalRefId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Invalidate count cache for this resource
    const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${resourceType}:${resourceId}`;
    await NocoCache.del(context, countCacheKey);
  }

  public static async delete(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Use soft delete by default
    return this.softDelete(
      context,
      resourceType,
      resourceId,
      principalType,
      principalRefId,
      ncMeta,
    );
  }

  public static async restore(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      { deleted: false },
      {
        resource_type: resourceType,
        resource_id: resourceId,
        principal_type: principalType,
        principal_ref_id: principalRefId,
      },
    );

    // Clear cache
    await NocoCache.deepDel(
      context,
      `${CacheScope.PRINCIPAL_ASSIGNMENT}:${resourceType}:${resourceId}:${principalType}:${principalRefId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Invalidate count cache for this resource
    const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${resourceType}:${resourceId}`;
    await NocoCache.del(context, countCacheKey);
  }

  public static async hardDelete(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        resource_type: resourceType,
        resource_id: resourceId,
        principal_type: principalType,
        principal_ref_id: principalRefId,
      },
    );

    // Clear cache - we don't have the exact cache key, so we'll let it expire
    await NocoCache.deepDel(
      context,
      CacheScope.PRINCIPAL_ASSIGNMENT,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Invalidate count cache for this resource
    const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${resourceType}:${resourceId}`;
    await NocoCache.del(context, countCacheKey);
  }

  public static async deleteByPrincipal(
    context: NcContext,
    principalType: PrincipalType,
    principalRefId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const assignments = await this.listByPrincipal(
      context,
      principalType,
      principalRefId,
      ncMeta,
    );

    for (const assignment of assignments) {
      await this.delete(
        context,
        assignment.resource_type,
        assignment.resource_id,
        assignment.principal_type,
        assignment.principal_ref_id,
        ncMeta,
      );
    }
  }
}
