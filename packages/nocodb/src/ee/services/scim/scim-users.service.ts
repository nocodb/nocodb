import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { User, Workspace, WorkspaceUser } from '~/ee/models';

interface ScimUserResource {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: {
    formatted?: string;
    familyName?: string;
    givenName?: string;
  };
  displayName?: string;
  emails: Array<{
    value: string;
    type?: string;
    primary?: boolean;
  }>;
  active: boolean;
  meta?: {
    resourceType: string;
    created?: string;
    lastModified?: string;
    location?: string;
  };
}

@Injectable()
export class ScimUsersService {
  protected logger = new Logger(ScimUsersService.name);

  constructor() {}

  /**
   * Get a single user by SCIM external ID
   */
  async getUser(
    context: NcContext,
    param: { workspaceId: string; scimId: string },
  ) {
    // Find workspace user by SCIM external ID
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
    });

    const workspaceUser = workspaceUsers.find(
      (wu) => wu.scim_external_id === param.scimId,
    );

    if (!workspaceUser || workspaceUser.deleted) {
      NcError.notFound('User not found');
    }

    return this.toScimUser(workspaceUser, param.workspaceId);
  }

  /**
   * List users with optional filtering and pagination
   */
  async listUsers(
    context: NcContext,
    param: {
      workspaceId: string;
      filter?: string;
      startIndex?: number;
      count?: number;
    },
  ) {
    const startIndex = param.startIndex || 1;
    const count = Math.min(param.count || 100, 100); // Max 100 per page

    let workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: false,
    });

    // Filter SCIM-managed users only
    workspaceUsers = workspaceUsers.filter((wu) => wu.scim_managed);

    // Apply SCIM filter if provided (basic support for userName eq filter)
    if (param.filter) {
      workspaceUsers = this.applyFilter(workspaceUsers, param.filter);
    }

    const totalResults = workspaceUsers.length;

    // Apply pagination
    const paginatedUsers = workspaceUsers.slice(
      startIndex - 1,
      startIndex - 1 + count,
    );

    const resources = await Promise.all(
      paginatedUsers.map((wu) => this.toScimUser(wu, param.workspaceId)),
    );

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  /**
   * Create a new user from SCIM data
   */
  async createUser(
    context: NcContext,
    param: {
      workspaceId: string;
      scimUser: any;
      req: any;
    },
  ) {
    const { scimUser, workspaceId } = param;

    // Extract email from SCIM user
    const primaryEmail =
      scimUser.emails?.find((e) => e.primary)?.value ||
      scimUser.emails?.[0]?.value;

    if (!primaryEmail) {
      NcError.badRequest('Email is required');
    }

    // Check if user already exists by email
    let user = await User.getByEmail(primaryEmail);

    // If user doesn't exist, create new user
    if (!user) {
      user = await User.insert({
        email: primaryEmail,
        display_name: scimUser.displayName || scimUser.name?.formatted,
        roles: 'user', // Default role
      });
    }

    // Check if workspace user already exists (include deleted for reactivation)
    const allWsUsers = await WorkspaceUser.userList({
      fk_workspace_id: workspaceId,
      include_deleted: true,
    });

    const existingWsUser = allWsUsers.find(
      (wu) => wu.fk_user_id === user.id,
    );

    if (existingWsUser && !existingWsUser.deleted) {
      NcError.badRequest('User already exists in workspace');
    }

    // Reactivate soft-deleted user
    if (existingWsUser?.deleted) {
      const updateData = {
        deleted: false,
        deleted_at: null,
        roles: existingWsUser.roles || WorkspaceUserRoles.VIEWER,
        scim_external_id: scimUser.externalId || scimUser.id,
        scim_managed: true,
        scim_user_name: scimUser.userName,
        scim_meta: {
          name: scimUser.name,
          displayName: scimUser.displayName,
          active: true,
        },
      };

      await WorkspaceUser.update(
        workspaceId,
        existingWsUser.fk_user_id,
        updateData,
      );

      const reactivatedUser = await WorkspaceUser.get(
        workspaceId,
        existingWsUser.fk_user_id,
      );

      return this.toScimUser(reactivatedUser, workspaceId);
    }

    // Create new workspace user with SCIM data
    const workspaceUser = await WorkspaceUser.insert({
      fk_workspace_id: workspaceId,
      fk_user_id: user.id,
      roles: WorkspaceUserRoles.VIEWER, // Default SCIM role
      scim_external_id: scimUser.externalId || scimUser.id,
      scim_managed: true,
      scim_user_name: scimUser.userName,
      scim_meta: {
        name: scimUser.name,
        displayName: scimUser.displayName,
        active: scimUser.active !== false,
      },
    });

    return this.toScimUser(workspaceUser, workspaceId);
  }

  /**
   * Update user (PUT - full replacement)
   */
  async replaceUser(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      scimUser: any;
    },
  ) {
    return this.updateUser(context, { ...param, isPatch: false });
  }

  /**
   * Update user (PATCH - partial update, supports SCIM PatchOp format)
   */
  async patchUser(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      scimUser: any;
    },
  ) {
    const { scimUser } = param;

    // If the body contains Operations array, parse it into a flat user object
    if (scimUser.Operations) {
      const flatUser: any = {};
      for (const op of scimUser.Operations) {
        if (op.op?.toLowerCase() === 'replace') {
          if (op.path) {
            // Single-value operation: { op: "Replace", path: "active", value: "False" }
            let val = op.value;
            // Handle string booleans (Entra ID sends "True"/"False")
            if (typeof val === 'string') {
              if (val.toLowerCase() === 'false') val = false;
              else if (val.toLowerCase() === 'true') val = true;
            }
            flatUser[op.path] = val;
          } else if (typeof op.value === 'object') {
            // Bulk operation: { op: "Replace", value: { displayName: "...", active: false } }
            Object.assign(flatUser, op.value);
          }
        }
      }
      return this.updateUser(context, {
        ...param,
        scimUser: flatUser,
        isPatch: true,
      });
    }

    return this.updateUser(context, { ...param, isPatch: true });
  }

  /**
   * Internal update logic
   */
  private async updateUser(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      scimUser: any;
      isPatch: boolean;
    },
  ) {
    const { workspaceId, scimId, scimUser } = param;

    // Find workspace user (include deleted so we can reactivate them)
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: workspaceId,
      include_deleted: true,
    });

    const workspaceUser = workspaceUsers.find(
      (wu) => wu.scim_external_id === scimId,
    );

    if (!workspaceUser) {
      NcError.notFound('User not found');
    }

    // Build update object
    const existingMeta = (workspaceUser.scim_meta as any) || {};
    const updateData: any = {
      scim_meta: {
        ...existingMeta,
        active: scimUser.active !== undefined ? scimUser.active !== false : existingMeta.active,
      },
    };

    if (scimUser.userName !== undefined) {
      updateData.scim_user_name = scimUser.userName;
    }

    if (scimUser.name !== undefined) {
      updateData.scim_meta.name = scimUser.name;
    }

    if (scimUser.displayName !== undefined) {
      updateData.scim_meta.displayName = scimUser.displayName;
    }

    // Handle active status (deactivation)
    if (scimUser.active === false) {
      updateData.deleted = true;
      updateData.deleted_at = new Date();
    } else if (scimUser.active === true && workspaceUser.deleted) {
      // Reactivate user
      updateData.deleted = false;
      updateData.deleted_at = null;
    }

    await WorkspaceUser.update(
      workspaceId,
      workspaceUser.fk_user_id,
      updateData,
    );

    // After deactivation, WorkspaceUser.get() filters out deleted users,
    // so we construct a merged object from the existing data + updates.
    if (updateData.deleted) {
      const mergedUser = {
        ...workspaceUser,
        ...updateData,
        scim_meta:
          typeof updateData.scim_meta === 'object'
            ? updateData.scim_meta
            : workspaceUser.scim_meta,
      };
      return this.toScimUser(mergedUser, workspaceId);
    }

    // For non-deactivation updates, fetch the latest from DB
    const updatedUser = await WorkspaceUser.get(
      workspaceId,
      workspaceUser.fk_user_id,
    );

    return this.toScimUser(updatedUser, workspaceId);
  }

  /**
   * Deactivate user (SCIM DELETE = soft delete)
   */
  async deactivateUser(
    context: NcContext,
    param: { workspaceId: string; scimId: string },
  ) {
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
    });

    const workspaceUser = workspaceUsers.find(
      (wu) => wu.scim_external_id === param.scimId,
    );

    if (!workspaceUser) {
      NcError.notFound('User not found');
    }

    await WorkspaceUser.softDelete(param.workspaceId, workspaceUser.fk_user_id);

    return { status: 'deleted' };
  }

  /**
   * Convert WorkspaceUser to SCIM User format
   */
  private async toScimUser(
    workspaceUser: any,
    workspaceId: string,
  ): Promise<ScimUserResource> {
    const scimMeta = workspaceUser.scim_meta || {};

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: workspaceUser.scim_external_id,
      externalId: workspaceUser.scim_external_id,
      userName: workspaceUser.scim_user_name || workspaceUser.email,
      name: scimMeta.name || {
        formatted: workspaceUser.display_name,
      },
      displayName: scimMeta.displayName || workspaceUser.display_name,
      emails: [
        {
          value: workspaceUser.email,
          type: 'work',
          primary: true,
        },
      ],
      active: !workspaceUser.deleted,
      meta: {
        resourceType: 'User',
        location: `/scim/v2/Users/${workspaceUser.scim_external_id}`,
      },
    };
  }

  /**
   * Apply basic SCIM filter (simplified implementation)
   */
  private applyFilter(users: any[], filter: string): any[] {
    // Support basic filter: userName eq "email@example.com"
    const userNameMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i);
    if (userNameMatch) {
      const userName = userNameMatch[1];
      return users.filter(
        (u) => u.scim_user_name === userName || u.email === userName,
      );
    }

    // Support: externalId eq "id"
    const externalIdMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i);
    if (externalIdMatch) {
      const externalId = externalIdMatch[1];
      return users.filter((u) => u.scim_external_id === externalId);
    }

    return users;
  }
}
