import { HttpException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { User, Workspace, WorkspaceUser } from '~/ee/models';

// Enterprise extension schema URI
const ENTERPRISE_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

@Injectable()
export class ScimUsersService {
  protected logger = new Logger(ScimUsersService.name);

  constructor() {}

  /**
   * Get a single user by SCIM ID
   */
  async getUser(
    context: NcContext,
    param: { workspaceId: string; scimId: string },
  ) {
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: true,
    });

    const workspaceUser = workspaceUsers.find(
      (wu) => wu.scim_external_id === param.scimId,
    );

    if (!workspaceUser) {
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
    const count = Math.min(param.count || 100, 100);

    let workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: true,
    });

    // Filter SCIM-managed users only
    workspaceUsers = workspaceUsers.filter((wu) => wu.scim_managed);

    // Apply SCIM filter if provided
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
        roles: 'user',
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
      // RFC 7644 §3.3: Return 409 Conflict for duplicate resources
      throw new HttpException(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          detail: 'User already exists in workspace',
          status: '409',
        },
        409,
      );
    }

    // Generate a server-side SCIM ID (RFC 7643 §3.1: id is server-assigned)
    const scimId =
      existingWsUser?.scim_external_id || uuidv4();

    // Build comprehensive scim_meta to round-trip all attributes
    const scimMeta = this.buildScimMeta(scimUser);

    // Reactivate soft-deleted user
    if (existingWsUser?.deleted) {
      const updateData = {
        deleted: false,
        deleted_at: null,
        roles: existingWsUser.roles || WorkspaceUserRoles.VIEWER,
        scim_external_id: scimId,
        scim_managed: true,
        scim_user_name: scimUser.userName,
        scim_meta: scimMeta,
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
      roles: WorkspaceUserRoles.VIEWER,
      scim_external_id: scimId,
      scim_managed: true,
      scim_user_name: scimUser.userName,
      scim_meta: scimMeta,
    });

    // WorkspaceUser.insert may not return the SCIM fields,
    // so fetch fresh from DB
    const freshUser = await WorkspaceUser.get(workspaceId, user.id);

    return this.toScimUser(freshUser || workspaceUser, workspaceId);
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
        } else if (op.op?.toLowerCase() === 'add') {
          if (op.path) {
            flatUser[op.path] = op.value;
          } else if (typeof op.value === 'object') {
            Object.assign(flatUser, op.value);
          }
        } else if (op.op?.toLowerCase() === 'remove') {
          if (op.path) {
            flatUser[op.path] = null;
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
      },
    };

    // Update active status in meta
    if (scimUser.active !== undefined) {
      updateData.scim_meta.active = scimUser.active !== false;
    }

    if (scimUser.userName !== undefined) {
      updateData.scim_user_name = scimUser.userName;
    }

    // For PUT (full replacement), rebuild all meta from the incoming SCIM user
    if (!param.isPatch) {
      updateData.scim_meta = this.buildScimMeta(scimUser);
    } else {
      // For PATCH, merge individual fields into existing meta
      this.mergeScimMetaFromPatch(updateData.scim_meta, scimUser);
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
  }

  /**
   * Build comprehensive scim_meta from incoming SCIM user data.
   * Stores ALL SCIM attributes for round-tripping.
   */
  private buildScimMeta(scimUser: any): Record<string, any> {
    const meta: Record<string, any> = {
      active: scimUser.active !== false,
    };

    // Core attributes
    if (scimUser.externalId !== undefined) meta.externalId = scimUser.externalId;
    if (scimUser.name !== undefined) meta.name = scimUser.name;
    if (scimUser.displayName !== undefined) meta.displayName = scimUser.displayName;
    if (scimUser.title !== undefined) meta.title = scimUser.title;
    if (scimUser.preferredLanguage !== undefined) meta.preferredLanguage = scimUser.preferredLanguage;
    if (scimUser.locale !== undefined) meta.locale = scimUser.locale;
    if (scimUser.timezone !== undefined) meta.timezone = scimUser.timezone;
    if (scimUser.userType !== undefined) meta.userType = scimUser.userType;
    if (scimUser.nickName !== undefined) meta.nickName = scimUser.nickName;
    if (scimUser.profileUrl !== undefined) meta.profileUrl = scimUser.profileUrl;

    // Multi-valued attributes
    if (scimUser.emails !== undefined) meta.emails = scimUser.emails;
    if (scimUser.phoneNumbers !== undefined) meta.phoneNumbers = scimUser.phoneNumbers;
    if (scimUser.addresses !== undefined) meta.addresses = scimUser.addresses;
    if (scimUser.roles !== undefined) meta.roles = scimUser.roles;

    // Enterprise extension
    if (scimUser[ENTERPRISE_EXTENSION] !== undefined) {
      meta[ENTERPRISE_EXTENSION] = scimUser[ENTERPRISE_EXTENSION];
    }

    return meta;
  }

  /**
   * Merge PATCH operation fields into existing scim_meta.
   * Handles both flat dotted paths (name.givenName) and
   * full enterprise extension URN paths.
   */
  private mergeScimMetaFromPatch(meta: any, patchData: any) {
    // Simple top-level fields
    const simpleFields = [
      'displayName', 'title', 'preferredLanguage', 'locale',
      'timezone', 'userType', 'nickName', 'profileUrl',
    ];

    for (const field of simpleFields) {
      if (patchData[field] !== undefined) {
        meta[field] = patchData[field];
      }
    }

    // Handle dotted name paths (name.givenName, name.familyName, etc.)
    if (!meta.name) meta.name = {};
    const nameFields = [
      'givenName', 'familyName', 'formatted', 'middleName',
      'honorificPrefix', 'honorificSuffix',
    ];
    for (const field of nameFields) {
      const dottedKey = `name.${field}`;
      if (patchData[dottedKey] !== undefined) {
        meta.name[field] = patchData[dottedKey];
      }
    }
    if (patchData.name !== undefined && typeof patchData.name === 'object') {
      meta.name = { ...meta.name, ...patchData.name };
    }

    // Handle emails patched via path like emails[type eq "work"].value
    if (patchData['emails[type eq "work"].value'] !== undefined) {
      if (!meta.emails) meta.emails = [{ type: 'work', primary: true }];
      const workEmail = meta.emails.find((e: any) => e.type === 'work') || meta.emails[0];
      if (workEmail) workEmail.value = patchData['emails[type eq "work"].value'];
    }
    if (patchData['emails[type eq "work"].primary'] !== undefined) {
      if (!meta.emails) meta.emails = [{ type: 'work' }];
      const workEmail = meta.emails.find((e: any) => e.type === 'work') || meta.emails[0];
      if (workEmail) workEmail.primary = patchData['emails[type eq "work"].primary'];
    }

    // Handle addresses patched via path
    this.mergeMultiValuedPatch(meta, 'addresses', 'work', patchData, [
      'formatted', 'streetAddress', 'locality', 'region',
      'postalCode', 'primary', 'country',
    ]);

    // Handle phoneNumbers patched via path
    for (const phoneType of ['work', 'mobile', 'fax']) {
      this.mergeMultiValuedPatch(meta, 'phoneNumbers', phoneType, patchData, [
        'value', 'primary',
      ]);
    }

    // Handle roles patched via path like roles[primary eq "True"].value
    this.mergeMultiValuedPatch(meta, 'roles', null, patchData, [
      'display', 'value', 'type',
    ], 'primary', 'True');

    // Handle enterprise extension paths
    const enterprisePrefix = `${ENTERPRISE_EXTENSION}:`;
    if (!meta[ENTERPRISE_EXTENSION]) meta[ENTERPRISE_EXTENSION] = {};
    for (const key of Object.keys(patchData)) {
      if (key.startsWith(enterprisePrefix)) {
        const field = key.substring(enterprisePrefix.length);
        meta[ENTERPRISE_EXTENSION][field] = patchData[key];
      }
    }
  }

  /**
   * Helper: merge multi-valued attribute patches from path-based operations
   */
  private mergeMultiValuedPatch(
    meta: any,
    attrName: string,
    typeValue: string | null,
    patchData: any,
    fields: string[],
    filterField = 'type',
    filterValue?: string,
  ) {
    const fVal = filterValue || typeValue;
    if (!fVal) return;

    for (const field of fields) {
      const pathKey = `${attrName}[${filterField} eq "${fVal}"].${field}`;
      if (patchData[pathKey] !== undefined) {
        if (!meta[attrName]) meta[attrName] = [];
        let item = meta[attrName].find((a: any) => a[filterField] === fVal);
        if (!item) {
          item = { [filterField]: fVal };
          meta[attrName].push(item);
        }
        item[field] = patchData[pathKey];
      }
    }
  }

  /**
   * Convert WorkspaceUser to SCIM User format with full attribute round-tripping
   */
  private async toScimUser(
    workspaceUser: any,
    workspaceId: string,
  ): Promise<any> {
    // Parse scim_meta if it's a JSON string (WorkspaceUser.get() doesn't auto-parse)
    let rawMeta = workspaceUser.scim_meta;
    if (typeof rawMeta === 'string') {
      try {
        rawMeta = JSON.parse(rawMeta);
      } catch {
        rawMeta = {};
      }
    }
    const scimMeta = rawMeta || {};

    // Build schemas array
    const schemas: string[] = [
      'urn:ietf:params:scim:schemas:core:2.0:User',
    ];
    if (scimMeta[ENTERPRISE_EXTENSION]) {
      schemas.push(ENTERPRISE_EXTENSION);
    }

    const result: any = {
      schemas,
      id: workspaceUser.scim_external_id,
      externalId: scimMeta.externalId || null,
      userName: workspaceUser.scim_user_name || workspaceUser.email,
      name: scimMeta.name || {
        formatted: workspaceUser.display_name,
      },
      displayName: scimMeta.displayName || workspaceUser.display_name,
      emails: scimMeta.emails || [
        {
          value: workspaceUser.email,
          type: 'work',
          primary: true,
        },
      ],
      active: !workspaceUser.deleted && scimMeta.active !== false,
      meta: {
        resourceType: 'User',
        location: `/scim/v2/Users/${workspaceUser.scim_external_id}`,
      },
    };

    // Add optional top-level attributes from scim_meta
    const optionalFields = [
      'title', 'preferredLanguage', 'locale', 'timezone',
      'userType', 'nickName', 'profileUrl',
    ];
    for (const field of optionalFields) {
      if (scimMeta[field] !== undefined && scimMeta[field] !== null) {
        result[field] = scimMeta[field];
      }
    }

    // Add multi-valued optional attributes
    if (scimMeta.phoneNumbers) result.phoneNumbers = scimMeta.phoneNumbers;
    if (scimMeta.addresses) result.addresses = scimMeta.addresses;
    if (scimMeta.roles) result.roles = scimMeta.roles;

    // Add enterprise extension
    if (scimMeta[ENTERPRISE_EXTENSION]) {
      result[ENTERPRISE_EXTENSION] = scimMeta[ENTERPRISE_EXTENSION];
    }

    return result;
  }

  /**
   * Apply SCIM filter with case-insensitive comparison (RFC 7644 §3.4.2.2)
   */
  private applyFilter(users: any[], filter: string): any[] {
    // Support basic filter: userName eq "email@example.com"
    const userNameMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i);
    if (userNameMatch) {
      const userName = userNameMatch[1].toLowerCase();
      return users.filter(
        (u) =>
          (u.scim_user_name || '').toLowerCase() === userName ||
          (u.email || '').toLowerCase() === userName,
      );
    }

    // Support: externalId eq "id"
    const externalIdMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i);
    if (externalIdMatch) {
      const externalId = externalIdMatch[1].toLowerCase();
      return users.filter(
        (u) => (u.scim_external_id || '').toLowerCase() === externalId,
      );
    }

    return users;
  }
}
