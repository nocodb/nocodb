import { HttpException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import isEmail from 'validator/lib/isEmail';
import { AppEvents, WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { UserType } from 'nocodb-sdk';
import type { ScimUserEvent } from '~/services/app-hooks/interfaces';
import { NcError } from '~/helpers/catchError';
import { User, WorkspaceUser } from '~/ee/models';
import Workspace from '~/ee/models/Workspace';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  extractWorkspaceRoleFromExtension,
  NOCODB_USER_EXTENSION,
  WORKSPACE_ROLE_TO_LABEL,
} from '~/services/scim/scim-helpers';
import { checkSeatLimit } from '~/helpers/paymentHelpers';

// Enterprise extension schema URI
const ENTERPRISE_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

@Injectable()
export class ScimUsersService {
  protected logger = new Logger(ScimUsersService.name);

  constructor(
    private readonly workspaceUsersService: WorkspaceUsersService,
    private readonly appHooksService: AppHooksService,
  ) {}

  /**
   * Extract and validate workspaceRole from NocoDB extension attribute.
   * Returns the WorkspaceUserRoles enum value, or undefined if not present.
   */
  private extractWorkspaceRole(
    scimUser: Record<string, unknown>,
  ): WorkspaceUserRoles | undefined {
    return extractWorkspaceRoleFromExtension(scimUser, NOCODB_USER_EXTENSION);
  }

  /**
   * Get a single user by SCIM ID
   */
  async getUser(
    context: NcContext,
    param: { workspaceId: string; scimId: string },
  ) {
    const workspaceUser = await WorkspaceUser.getByScimExternalId(
      param.workspaceId,
      param.scimId,
      { include_deleted: true },
    );

    if (!workspaceUser) {
      NcError.notFound('User not found');
    }

    return this.toScimUser(workspaceUser);
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
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const startIndex = param.startIndex || 1;
    const count =
      param.count !== undefined ? Math.min(param.count, 100) : 100;
    const ascending =
      !param.sortOrder || param.sortOrder.toLowerCase() === 'ascending';

    // Parse SCIM filter into DB-level params
    let filterUserName: string | undefined;
    let filterExternalId: string | undefined;
    if (param.filter) {
      const userNameMatch = param.filter.match(/userName\s+eq\s+"([^"]+)"/i);
      const externalIdMatch = param.filter.match(
        /externalId\s+eq\s+"([^"]+)"/i,
      );

      if (!userNameMatch && !externalIdMatch) {
        throw new HttpException(
          {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: `Invalid or unsupported filter: ${param.filter}. Supported filters: userName eq "value", externalId eq "value"`,
            status: '400',
            scimType: 'invalidFilter',
          },
          400,
        );
      }

      if (userNameMatch) filterUserName = userNameMatch[1];
      if (externalIdMatch) filterExternalId = externalIdMatch[1];
    }

    // SQL-level filtering, sorting, and pagination
    const { list: paginatedUsers, totalResults } = await WorkspaceUser.scimList(
      {
        fk_workspace_id: param.workspaceId,
        include_deleted: true,
        offset: startIndex - 1,
        limit: count || 1, // fetch at least 1 to get totalResults
        filterUserName,
        filterExternalId,
        sortBy: param.sortBy,
        sortAscending: ascending,
      },
    );

    // RFC 7644 §3.4.2.4: count=0 returns metadata only (no resources)
    if (count === 0) {
      return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults,
        startIndex,
        itemsPerPage: 0,
        Resources: [],
      };
    }

    const resources = await Promise.all(
      paginatedUsers.map((wu) => this.toScimUser(wu)),
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
      scimUser: Record<string, any>;
      req: NcRequest;
    },
  ) {
    const { scimUser, workspaceId } = param;

    const primaryEmail = this.extractEmail(scimUser);

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

    // Targeted lookup with include_deleted for reactivation support
    const existingWsUser = await WorkspaceUser.get(workspaceId, user.id, {
      include_deleted: true,
    });

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

    // Always generate a fresh SCIM ID (RFC 7643 §3.1: id is server-assigned)
    // Even for reactivated users, a new ID avoids stale IdP references
    const scimId = uuidv4();

    // Build comprehensive scim_meta to round-trip all attributes
    const scimMeta = this.buildScimMeta(scimUser);

    // Extract workspace role from NocoDB extension (if provided)
    const workspaceRole =
      this.extractWorkspaceRole(scimUser) || WorkspaceUserRoles.VIEWER;

    // Reactivate soft-deleted user
    if (existingWsUser?.deleted) {
      await checkSeatLimit(
        workspaceId,
        existingWsUser.fk_user_id,
        WorkspaceUserRoles.NO_ACCESS,
        workspaceRole,
      );

      const updateData = {
        deleted: false,
        deleted_at: null,
        roles: workspaceRole,
        scim_external_id: scimId,
        scim_managed: true,
        scim_user_name: scimUser.userName,
        scim_meta: scimMeta,
      };

      // WorkspaceUser.update returns the full record (calls get() internally)
      const reactivatedUser = await WorkspaceUser.update(
        workspaceId,
        existingWsUser.fk_user_id,
        updateData,
      );

      // Restore caches and seat count after reactivation
      await this.workspaceUsersService.restoreWorkspaceUser({
        context,
        workspaceId,
        userId: existingWsUser.fk_user_id,
      });

      this.emitScimEvent(AppEvents.SCIM_USER_REACTIVATE, {
        workspaceId,
        user,
        workspaceUser: reactivatedUser,
        scimId,
        req: param.req,
      });

      return this.toScimUser(reactivatedUser);
    }

    // Check seat limit before creating new workspace user
    await checkSeatLimit(
      workspaceId,
      user.id,
      WorkspaceUserRoles.NO_ACCESS,
      workspaceRole,
    );

    // Create new workspace user with SCIM data
    // (WorkspaceUser.insert calls get() internally and returns the full record)
    const workspaceUser = await WorkspaceUser.insert({
      fk_workspace_id: workspaceId,
      fk_user_id: user.id,
      roles: workspaceRole,
      scim_external_id: scimId,
      scim_managed: true,
      scim_user_name: scimUser.userName,
      scim_meta: scimMeta,
    });

    this.emitScimEvent(AppEvents.SCIM_USER_PROVISION, {
      workspaceId,
      user,
      workspaceUser,
      scimId,
      req: param.req,
    });

    return this.toScimUser(workspaceUser);
  }

  /**
   * Update user (PUT - full replacement)
   */
  async replaceUser(
    context: NcContext,
    param: {
      workspaceId: string;
      scimId: string;
      scimUser: Record<string, any>;
      req: NcRequest;
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
      scimUser: Record<string, any>;
      req: NcRequest;
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
            // Handle NocoDB extension path (e.g. "urn:...:User:workspaceRole")
            const nocoExtPrefix = `${NOCODB_USER_EXTENSION}:`;
            if (op.path.startsWith(nocoExtPrefix)) {
              const field = op.path.substring(nocoExtPrefix.length);
              if (!flatUser[NOCODB_USER_EXTENSION])
                flatUser[NOCODB_USER_EXTENSION] = {};
              flatUser[NOCODB_USER_EXTENSION][field] = val;
            } else {
              flatUser[op.path] = val;
            }
          } else if (typeof op.value === 'object') {
            // Bulk operation: { op: "Replace", value: { displayName: "...", active: false } }
            // Check for NocoDB extension in bulk value
            if (op.value[NOCODB_USER_EXTENSION]) {
              flatUser[NOCODB_USER_EXTENSION] = op.value[NOCODB_USER_EXTENSION];
            }
            Object.assign(flatUser, op.value);
          }
        } else if (op.op?.toLowerCase() === 'add') {
          if (op.path) {
            const nocoExtPrefix = `${NOCODB_USER_EXTENSION}:`;
            if (op.path.startsWith(nocoExtPrefix)) {
              const field = op.path.substring(nocoExtPrefix.length);
              if (!flatUser[NOCODB_USER_EXTENSION])
                flatUser[NOCODB_USER_EXTENSION] = {};
              flatUser[NOCODB_USER_EXTENSION][field] = op.value;
            } else {
              flatUser[op.path] = op.value;
            }
          } else if (typeof op.value === 'object') {
            if (op.value[NOCODB_USER_EXTENSION]) {
              flatUser[NOCODB_USER_EXTENSION] = op.value[NOCODB_USER_EXTENSION];
            }
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
      scimUser: Record<string, any>;
      isPatch: boolean;
      req: NcRequest;
    },
  ) {
    const { workspaceId, scimId, scimUser } = param;

    // Direct indexed lookup (include deleted so we can reactivate them)
    const workspaceUser = await WorkspaceUser.getByScimExternalId(
      workspaceId,
      scimId,
      { include_deleted: true },
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

    // Handle workspace role from NocoDB extension attribute
    const newRole = this.extractWorkspaceRole(scimUser);
    if (newRole) {
      await checkSeatLimit(
        workspaceId,
        workspaceUser.fk_user_id,
        workspaceUser.roles as WorkspaceUserRoles,
        newRole,
      );
      updateData.roles = newRole;
    }

    // Handle active status (deactivation)
    const isDeactivating = scimUser.active === false && !workspaceUser.deleted;
    if (scimUser.active === false) {
      updateData.deleted = true;
      updateData.deleted_at = new Date();
    } else if (scimUser.active === true && workspaceUser.deleted) {
      // Reactivate user — check seat limit before restoring
      const effectiveRole =
        newRole || (workspaceUser.roles as WorkspaceUserRoles);
      await checkSeatLimit(
        workspaceId,
        workspaceUser.fk_user_id,
        WorkspaceUserRoles.NO_ACCESS,
        effectiveRole,
      );
      updateData.deleted = false;
      updateData.deleted_at = null;
    }

    // Persist the update
    await WorkspaceUser.update(
      workspaceId,
      workspaceUser.fk_user_id,
      updateData,
    );

    // Determine reactivation before cleanup (workspaceUser.deleted is pre-update state)
    const isReactivating =
      scimUser.active === true && workspaceUser.deleted && !isDeactivating;

    // Full cleanup on deactivation (base access, teams, orphan bases, seat recount)
    if (isDeactivating) {
      await this.workspaceUsersService.cleanupWorkspaceUser({
        context,
        workspaceId,
        userId: workspaceUser.fk_user_id,
      });
    }

    // Restore caches and seat count on reactivation
    if (isReactivating) {
      await this.workspaceUsersService.restoreWorkspaceUser({
        context,
        workspaceId,
        userId: workspaceUser.fk_user_id,
      });
    }

    if (isDeactivating) {
      this.emitScimEvent(AppEvents.SCIM_USER_DEACTIVATE, {
        workspaceId,
        userId: workspaceUser.fk_user_id,
        workspaceUser,
        scimId,
        req: param.req,
      });
    } else if (isReactivating) {
      this.emitScimEvent(AppEvents.SCIM_USER_REACTIVATE, {
        workspaceId,
        userId: workspaceUser.fk_user_id,
        workspaceUser,
        scimId,
        req: param.req,
      });
    } else {
      this.emitScimEvent(AppEvents.SCIM_USER_UPDATE, {
        workspaceId,
        userId: workspaceUser.fk_user_id,
        workspaceUser,
        scimId,
        req: param.req,
      });
    }

    // Re-fetch from DB via getByScimExternalId (same code path as GET)
    // to ensure response reflects persisted state and scim_meta is parsed
    const refreshed = await WorkspaceUser.getByScimExternalId(
      workspaceId,
      scimId,
      { include_deleted: true },
    );

    if (refreshed) {
      return this.toScimUser(refreshed);
    }

    // Fallback for edge cases (e.g. race condition on deactivation)
    return this.toScimUser({ ...workspaceUser, ...updateData });
  }

  /**
   * Deactivate user (SCIM DELETE = soft delete)
   */
  async deactivateUser(
    context: NcContext,
    param: { workspaceId: string; scimId: string; req: NcRequest },
  ) {
    // Direct indexed lookup (include deleted so we can distinguish not-found vs already-deleted)
    const workspaceUser = await WorkspaceUser.getByScimExternalId(
      param.workspaceId,
      param.scimId,
      { include_deleted: true },
    );

    // RFC 7644 §3.6: Return 404 if the resource does not exist
    if (!workspaceUser) {
      NcError.notFound('User not found');
    }

    // Already deactivated — return 404 (Microsoft SCIM compliance requires
    // 404 for DELETE on an already-deleted resource)
    if (workspaceUser.deleted) {
      NcError.notFound('User not found');
    }

    await WorkspaceUser.softDelete(param.workspaceId, workspaceUser.fk_user_id);

    // Full cleanup: base access, team membership, orphan bases, seat recount, socket notification
    await this.workspaceUsersService.cleanupWorkspaceUser({
      context,
      workspaceId: param.workspaceId,
      userId: workspaceUser.fk_user_id,
    });

    this.emitScimEvent(AppEvents.SCIM_USER_DELETE, {
      workspaceId: param.workspaceId,
      userId: workspaceUser.fk_user_id,
      workspaceUser,
      scimId: param.scimId,
      req: param.req,
    });
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
    if (scimUser.externalId !== undefined)
      meta.externalId = scimUser.externalId;
    if (scimUser.name !== undefined) meta.name = scimUser.name;
    if (scimUser.displayName !== undefined)
      meta.displayName = scimUser.displayName;
    if (scimUser.title !== undefined) meta.title = scimUser.title;
    if (scimUser.preferredLanguage !== undefined)
      meta.preferredLanguage = scimUser.preferredLanguage;
    if (scimUser.locale !== undefined) meta.locale = scimUser.locale;
    if (scimUser.timezone !== undefined) meta.timezone = scimUser.timezone;
    if (scimUser.userType !== undefined) meta.userType = scimUser.userType;
    if (scimUser.nickName !== undefined) meta.nickName = scimUser.nickName;
    if (scimUser.profileUrl !== undefined)
      meta.profileUrl = scimUser.profileUrl;

    // Multi-valued attributes
    if (scimUser.emails !== undefined) meta.emails = scimUser.emails;
    if (scimUser.phoneNumbers !== undefined)
      meta.phoneNumbers = scimUser.phoneNumbers;
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
      'displayName',
      'title',
      'preferredLanguage',
      'locale',
      'timezone',
      'userType',
      'nickName',
      'profileUrl',
    ];

    for (const field of simpleFields) {
      if (patchData[field] !== undefined) {
        meta[field] = patchData[field];
      }
    }

    // Handle dotted name paths (name.givenName, name.familyName, etc.)
    if (!meta.name) meta.name = {};
    const nameFields = [
      'givenName',
      'familyName',
      'formatted',
      'middleName',
      'honorificPrefix',
      'honorificSuffix',
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
      const emailValue = patchData['emails[type eq "work"].value'];
      if (!emailValue || (typeof emailValue === 'string' && !emailValue.trim())) {
        NcError.badRequest('Email value cannot be empty');
      }
      if (typeof emailValue === 'string' && !isEmail(emailValue)) {
        NcError.badRequest('Invalid email format');
      }
      if (!meta.emails) meta.emails = [{ type: 'work', primary: true }];
      const workEmail =
        meta.emails.find((e: any) => e.type === 'work') || meta.emails[0];
      if (workEmail) workEmail.value = emailValue;
    }
    if (patchData['emails[type eq "work"].primary'] !== undefined) {
      if (!meta.emails) meta.emails = [{ type: 'work' }];
      const workEmail =
        meta.emails.find((e: any) => e.type === 'work') || meta.emails[0];
      if (workEmail)
        workEmail.primary = patchData['emails[type eq "work"].primary'];
    }

    // Handle addresses patched via path
    this.mergeMultiValuedPatch(meta, 'addresses', 'work', patchData, [
      'formatted',
      'streetAddress',
      'locality',
      'region',
      'postalCode',
      'primary',
      'country',
    ]);

    // Handle phoneNumbers patched via path
    for (const phoneType of ['work', 'mobile', 'fax']) {
      this.mergeMultiValuedPatch(meta, 'phoneNumbers', phoneType, patchData, [
        'value',
        'primary',
      ]);
    }

    // Handle roles patched via path like roles[primary eq "True"].value
    this.mergeMultiValuedPatch(
      meta,
      'roles',
      null,
      patchData,
      ['display', 'value', 'type'],
      'primary',
      'True',
    );

    // Handle enterprise extension paths
    const enterprisePrefix = `${ENTERPRISE_EXTENSION}:`;
    if (!meta[ENTERPRISE_EXTENSION]) meta[ENTERPRISE_EXTENSION] = {};
    for (const key of Object.keys(patchData)) {
      if (key.startsWith(enterprisePrefix)) {
        const field = key.substring(enterprisePrefix.length);
        // RFC 7643: 'manager' is a complex attribute with sub-attributes
        // (value, $ref, displayName). When patched via path, the value
        // is typically just the ID string — wrap it as {value: string}.
        if (field === 'manager' && typeof patchData[key] === 'string') {
          meta[ENTERPRISE_EXTENSION][field] = { value: patchData[key] };
        } else {
          meta[ENTERPRISE_EXTENSION][field] = patchData[key];
        }
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

    // Convert filter value to proper type for storage (e.g. "True" → true
    // for 'primary' which SCIM defines as boolean, not string)
    const storedFVal =
      filterField === 'primary'
        ? typeof fVal === 'string'
          ? fVal.toLowerCase() === 'true'
          : fVal
        : fVal;

    for (const field of fields) {
      const pathKey = `${attrName}[${filterField} eq "${fVal}"].${field}`;
      if (patchData[pathKey] !== undefined) {
        if (!meta[attrName]) meta[attrName] = [];
        let item = meta[attrName].find(
          (a: any) => a[filterField] === storedFVal || a[filterField] === fVal,
        );
        if (!item) {
          item = { [filterField]: storedFVal };
          meta[attrName].push(item);
        }
        item[field] = patchData[pathKey];
      }
    }
  }

  /**
   * Convert WorkspaceUser to SCIM User format with full attribute round-tripping
   */
  private async toScimUser(workspaceUser: any): Promise<Record<string, any>> {
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
    const schemas: string[] = ['urn:ietf:params:scim:schemas:core:2.0:User'];
    if (scimMeta[ENTERPRISE_EXTENSION]) {
      schemas.push(ENTERPRISE_EXTENSION);
    }

    const result: any = {
      schemas,
      id: workspaceUser.scim_external_id,
      // externalId is optional (RFC 7643 §3.1); omit rather than null to
      // satisfy the schema constraint that it must be a string when present
      ...(scimMeta.externalId ? { externalId: scimMeta.externalId } : {}),
      userName: workspaceUser.scim_user_name || workspaceUser.email,
      name:
        scimMeta.name ||
        (workspaceUser.display_name
          ? { formatted: workspaceUser.display_name }
          : {}),
      displayName:
        scimMeta.displayName ||
        workspaceUser.display_name ||
        workspaceUser.scim_user_name ||
        workspaceUser.email,
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
        ...(workspaceUser.created_at
          ? { created: new Date(workspaceUser.created_at).toISOString() }
          : {}),
        ...(workspaceUser.updated_at
          ? { lastModified: new Date(workspaceUser.updated_at).toISOString() }
          : workspaceUser.created_at
          ? { lastModified: new Date(workspaceUser.created_at).toISOString() }
          : {}),
      },
    };

    // Add optional top-level attributes from scim_meta
    const optionalFields = [
      'title',
      'preferredLanguage',
      'locale',
      'timezone',
      'userType',
      'nickName',
      'profileUrl',
    ];
    for (const field of optionalFields) {
      if (scimMeta[field] !== undefined && scimMeta[field] !== null) {
        result[field] = scimMeta[field];
      }
    }

    // Add multi-valued optional attributes
    if (scimMeta.phoneNumbers) result.phoneNumbers = scimMeta.phoneNumbers;
    if (scimMeta.addresses) result.addresses = scimMeta.addresses;
    if (scimMeta.roles) {
      // Sanitize boolean fields: SCIM path filters store "True"/"False"
      // as strings, but the schema requires native booleans
      result.roles = scimMeta.roles.map((r: any) => ({
        ...r,
        ...(r.primary !== undefined
          ? {
              primary:
                typeof r.primary === 'string'
                  ? r.primary.toLowerCase() === 'true'
                  : r.primary,
            }
          : {}),
      }));
    }

    // Add enterprise extension
    if (scimMeta[ENTERPRISE_EXTENSION]) {
      result[ENTERPRISE_EXTENSION] = scimMeta[ENTERPRISE_EXTENSION];
    }

    // Add NocoDB User extension (workspaceRole)
    const wsRoleLabel = WORKSPACE_ROLE_TO_LABEL[workspaceUser.roles];
    if (wsRoleLabel) {
      result.schemas.push(NOCODB_USER_EXTENSION);
      result[NOCODB_USER_EXTENSION] = { workspaceRole: wsRoleLabel };
    }

    return result;
  }

  /**
   * Emit a SCIM audit event asynchronously (fire-and-forget).
   * Fetches workspace + user objects needed for the audit payload.
   */
  private emitScimEvent(
    event:
      | AppEvents.SCIM_USER_PROVISION
      | AppEvents.SCIM_USER_UPDATE
      | AppEvents.SCIM_USER_DEACTIVATE
      | AppEvents.SCIM_USER_REACTIVATE
      | AppEvents.SCIM_USER_DELETE,
    param: {
      workspaceId: string;
      user?: UserType;
      userId?: string;
      workspaceUser: Partial<WorkspaceUser>;
      scimId: string;
      req: NcRequest;
    },
  ) {
    // Fire-and-forget: resolve workspace + user then emit
    Promise.all([
      Workspace.get(param.workspaceId),
      param.user
        ? Promise.resolve(param.user)
        : User.get(param.userId || param.workspaceUser.fk_user_id),
    ])
      .then(([workspace, user]) => {
        if (!workspace || !user) return;
        this.appHooksService.emit(event, {
          workspace,
          user,
          workspaceUser: param.workspaceUser,
          scimId: param.scimId,
          req: param.req,
        } as ScimUserEvent);
      })
      .catch((e) => {
        this.logger.error(`Failed to emit SCIM audit event: ${event}`, e);
      });
  }

  /**
   * Extract and validate email from SCIM user payload.
   *
   * IdP-specific behaviour:
   *  - Okta / JumpCloud / Duo  → emails[primary=true].value
   *  - Azure AD (Entra ID)     → emails[type="work"].value, userName must match
   *  - OneLogin                → emails[] or userName when emails absent
   *  - Google Workspace        → single email in emails[]
   *  - PingIdentity            → single email in emails[]
   *
   * Extraction priority (RFC 7643 §4.1.2):
   *  1. emails entry with primary=true
   *  2. emails entry with type="work"
   *  3. first emails entry
   *  4. userName (if it's a valid email)
   */
  private extractEmail(scimUser: any): string | null {
    const emails = scimUser.emails;

    let candidate: string | null = null;

    if (Array.isArray(emails) && emails.length > 0) {
      candidate =
        emails.find((e: any) => e.primary)?.value ||
        emails.find((e: any) => e.type === 'work')?.value ||
        emails[0]?.value ||
        null;
    }

    // Fallback: userName (OneLogin, some custom IdPs)
    if (!candidate && scimUser.userName) {
      candidate = scimUser.userName;
    }

    if (!candidate) return null;

    candidate = candidate.trim().toLowerCase();

    if (!isEmail(candidate)) return null;

    return candidate;
  }
}
