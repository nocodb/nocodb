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

/**
 * PrincipalAssignment model for managing role-based access control
 *
 * This model handles assignments of principals (users, teams, bots) to resources
 * (organizations, workspaces, bases, teams) with specific roles.
 *
 * Key concepts:
 * - Principal: The entity being assigned (user, team, bot)
 * - Resource: The entity being accessed (org, workspace, base, team)
 * - Role: The permission level granted to the principal for the resource
 * - Soft Delete: Records are marked as deleted but not physically removed
 */
export default class PrincipalAssignment {
  resource_type: ResourceType; // Type of resource (workspace, base, team, etc.)
  resource_id: string; // Unique identifier of the resource
  principal_type: PrincipalType; // Type of principal (user, team, bot)
  principal_ref_id: string; // Unique identifier of the principal
  roles: string; // Comma-separated roles assigned to the principal
  deleted: boolean; // Soft delete flag - true means assignment is inactive
  created_at?: string; // Timestamp when assignment was created
  updated_at?: string; // Timestamp when assignment was last modified

  constructor(data: PrincipalAssignment) {
    Object.assign(this, data);
  }

  /**
   * Casts raw database data to PrincipalAssignment instance
   * @param assignment Raw assignment data from database
   * @returns PrincipalAssignment instance
   */
  protected static castType(
    assignment: PrincipalAssignment,
  ): PrincipalAssignment {
    return assignment && new PrincipalAssignment(assignment);
  }

  /**
   * Creates a new principal assignment or restores a soft-deleted one
   *
   * This method handles two scenarios:
   * 1. If a soft-deleted assignment exists, it restores it with new roles
   * 2. If no assignment exists, it creates a new one
   *
   * @param context NocoDB context
   * @param assignment Assignment data to create/restore
   * @param ncMeta Database metadata instance
   * @returns Created or restored PrincipalAssignment
   */
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
      // Restore the soft-deleted assignment with new roles
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

      // Retrieve the restored assignment
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

      // Update cache with restored assignment
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

    // Set deleted to false by default for new assignments
    insertObj.deleted = false;

    await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      insertObj,
      true,
    );

    // Retrieve the newly created assignment (excluding soft-deleted ones)
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

    // Cache the assignment
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

  /**
   * Retrieves a specific principal assignment
   *
   * @param context NocoDB context
   * @param resourceType Type of resource to search for
   * @param resourceId ID of the resource
   * @param principalType Type of principal to search for
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   * @returns PrincipalAssignment if found, null otherwise
   */
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

  /**
   * Lists principal assignments with optional filtering
   *
   * By default, excludes soft-deleted assignments unless explicitly requested.
   *
   * @param context NocoDB context
   * @param filter Optional filters for the query
   * @param ncMeta Database metadata instance
   * @returns Array of PrincipalAssignment instances
   */
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

  /**
   * Lists all assignments for a specific resource
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param ncMeta Database metadata instance
   * @returns Array of PrincipalAssignment instances for the resource
   */
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

  /**
   * Lists all assignments for a specific principal
   *
   * @param context NocoDB context
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   * @returns Array of PrincipalAssignment instances for the principal
   */
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

  /**
   * Counts the number of assignments for a specific resource
   *
   * Uses caching to improve performance for frequently accessed counts.
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param ncMeta Database metadata instance
   * @returns Number of assignments for the resource
   */
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

  /**
   * Counts assignments for a specific resource and role
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param role Specific role to count
   * @param ncMeta Database metadata instance
   * @returns Number of assignments with the specified role
   */
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

  /**
   * Updates an existing principal assignment
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param updateData Data to update (currently only supports roles)
   * @param ncMeta Database metadata instance
   * @returns Updated PrincipalAssignment
   */
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

  /**
   * Soft deletes a principal assignment (marks as deleted but doesn't remove from database)
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   */
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

  /**
   * Deletes a principal assignment (uses soft delete by default)
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   */
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

  /**
   * Restores a soft-deleted principal assignment
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   */
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

  /**
   * Permanently deletes a principal assignment from the database
   *
   * WARNING: This operation cannot be undone!
   *
   * @param context NocoDB context
   * @param resourceType Type of resource
   * @param resourceId ID of the resource
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   */
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

  /**
   * Deletes all assignments for a specific principal
   *
   * This is useful when removing a user, team, or bot from the system.
   *
   * @param context NocoDB context
   * @param principalType Type of principal
   * @param principalRefId ID of the principal
   * @param ncMeta Database metadata instance
   */
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
