import type { NcContext } from '~/interface/config';
import type { ResourceType } from '~/utils/globals';
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
  fk_principal_id: string; // FK to principals table
  roles: string; // Role(s) assigned
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
    const insertObj = extractProps(assignment, [
      'resource_type',
      'resource_id',
      'fk_principal_id',
      'roles',
    ]);

    await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      insertObj,
      true,
    );

    const assignmentData = await ncMeta.metaGet(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        resource_id: insertObj.resource_id,
        fk_principal_id: insertObj.fk_principal_id,
        resource_type: insertObj.resource_type,
      },
    );

    await NocoCache.set(
      context,
      `${CacheScope.PRINCIPAL_ASSIGNMENT}:${insertObj.resource_type}:${insertObj.resource_id}:${insertObj.fk_principal_id}`,
      assignmentData,
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
    principalId: string,
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
          fk_principal_id: principalId,
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
      fk_principal_id?: string;
      roles?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment[]> {
    const assignments = await ncMeta.metaList2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        condition: filter,
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
    principalId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<PrincipalAssignment[]> {
    return this.list(
      context,
      {
        fk_principal_id: principalId,
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
      return cachedCount;
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
    await NocoCache.setExpiring(context, cacheKey, count, 300);

    return count;
  }

  public static async countByResourceAndRole(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    role: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const assignments = await this.list(
      context,
      {
        resource_type: resourceType,
        resource_id: resourceId,
        roles: role,
      },
      ncMeta,
    );
    return assignments.length;
  }

  public static async update(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalId: string,
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
        fk_principal_id: principalId,
      },
    );

    const updatedAssignment = await this.get(
      context,
      resourceType,
      resourceId,
      principalId,
      ncMeta,
    );

    if (updatedAssignment) {
      await NocoCache.set(
        context,
        `${CacheScope.PRINCIPAL_ASSIGNMENT}:${resourceType}:${resourceId}:${principalId}`,
        updatedAssignment,
      );
    }

    // Invalidate count cache for this resource
    const countCacheKey = `${CacheScope.PRINCIPAL_ASSIGNMENT}:count:${resourceType}:${resourceId}`;
    await NocoCache.del(context, countCacheKey);

    return updatedAssignment!;
  }

  public static async delete(
    context: NcContext,
    resourceType: ResourceType,
    resourceId: string,
    principalId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        resource_type: resourceType,
        resource_id: resourceId,
        fk_principal_id: principalId,
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
    principalId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const assignments = await this.listByPrincipal(
      context,
      principalId,
      ncMeta,
    );

    for (const assignment of assignments) {
      await this.delete(
        context,
        assignment.resource_type,
        assignment.resource_id,
        assignment.fk_principal_id,
        ncMeta,
      );
    }
  }
}
