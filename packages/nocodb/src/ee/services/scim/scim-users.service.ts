import { HttpException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import isEmail from 'validator/lib/isEmail';
import { AppEvents, EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { UserType } from 'nocodb-sdk';
import type { ScimUserEvent } from '~/services/app-hooks/interfaces';
import { NcError } from '~/helpers/catchError';
import { User } from '~/ee/models';
import OrgUser from '~/ee/models/OrgUser';
import Org from '~/ee/models/Org';
import ScimConfig from '~/ee/models/ScimConfig';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  extractOrgRoleFromExtension,
  NOCODB_USER_EXTENSION,
  ORG_ROLE_TO_LABEL,
} from '~/services/scim/scim-helpers';
// Seat limits are workspace-scoped; org-level SCIM provisioning
// does not enforce them (users are added to workspaces separately).

// Enterprise extension schema URI
const ENTERPRISE_EXTENSION =
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

@Injectable()
export class ScimUsersService {
  protected logger = new Logger(ScimUsersService.name);

  constructor(
    private readonly appHooksService: AppHooksService,
  ) {}

  /**
   * Extract and validate orgRole from NocoDB extension attribute.
   * Returns the EnterpriseOrgUserRoles enum value, or undefined if not present.
   */
  private extractOrgRole(
    scimUser: Record<string, unknown>,
  ): EnterpriseOrgUserRoles | undefined {
    return extractOrgRoleFromExtension(scimUser, NOCODB_USER_EXTENSION);
  }

  /**
   * Get a single user by SCIM ID
   */
  async getUser(
    _context: NcContext,
    param: { orgId: string; scimId: string },
  ) {
    const orgUser = await OrgUser.getByScimExternalId(
      param.orgId,
      param.scimId,
      { include_deleted: true },
    );

    if (!orgUser) {
      NcError.notFound('User not found');
    }

    return this.toScimUser(orgUser);
  }

  /**
   * List users with optional filtering and pagination
   */
  async listUsers(
    _context: NcContext,
    param: {
      orgId: string;
      filter?: string;
      startIndex?: number;
      count?: number;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const startIndex = param.startIndex || 1;
    const count = param.count !== undefined ? Math.min(param.count, 100) : 100;
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
    const { list: paginatedUsers, totalResults } = await OrgUser.scimList({
      fk_org_id: param.orgId,
      include_deleted: true,
      offset: startIndex - 1,
      limit: count || 1, // fetch at least 1 to get totalResults
      filterUserName,
      filterExternalId,
      sortBy: param.sortBy,
      sortAscending: ascending,
    });

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
      paginatedUsers.map((ou) => this.toScimUser(ou)),
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
      orgId: string;
      scimUser: Record<string, any>;
      req: NcRequest;
    },
  ) {
    const { scimUser, orgId } = param;

    const primaryEmail = this.extractEmail(scimUser);

    if (!primaryEmail) {
      NcError.badRequest('Email is required');
    }

    // If externalId is provided, check if an existing org user has the same
    // IdP externalId but a different email — this means the IdP changed the email.
    // Email is the primary identifier in NocoDB and cannot be changed, so
    // soft-delete the old user and create a fresh one with the new email.
    if (scimUser.externalId) {
      const existingByExtId = await this.findOrgUserByIdpExternalId(
        orgId,
        scimUser.externalId,
      );
      if (existingByExtId) {
        const existingUser = await User.get(existingByExtId.fk_user_id);
        if (existingUser && existingUser.email !== primaryEmail) {
          await OrgUser.softDelete(orgId, existingUser.id);
        }
      }
    }

    // Check if user already exists by email
    let user = await User.getByEmail(primaryEmail);

    // Build display name from SCIM fields
    const displayName =
      scimUser.displayName ||
      scimUser.name?.formatted ||
      [scimUser.name?.givenName, scimUser.name?.familyName].filter(Boolean).join(' ') ||
      undefined;

    // If user doesn't exist, create new user
    if (!user) {
      user = await User.insert({
        email: primaryEmail,
        display_name: displayName,
        roles: 'user',
      });
    } else if (displayName && !user.display_name) {
      // Update display_name if user exists but has no name set
      await User.update(user.id, { display_name: displayName });
    }

    // Targeted lookup with include_deleted for reactivation support
    const existingOrgUser = await OrgUser.get(orgId, user.id, {
      include_deleted: true,
    });

    // SCIM ID: use IdP's externalId if provided (stable across email changes),
    // otherwise generate a server UUID (RFC 7643 §3.1)
    const scimId = scimUser.externalId || uuidv4();

    // Build comprehensive scim_meta to round-trip all attributes
    const scimMeta = this.buildScimMeta(scimUser);

    // Extract org role from NocoDB extension (if provided)
    const extensionRole = this.extractOrgRole(scimUser);

    // IdP wins on conflict: if user already exists, adopt as SCIM-managed
    // Keep existing role unless the SCIM extension explicitly provides one
    if (existingOrgUser && !existingOrgUser.deleted) {
      if (existingOrgUser.scim_managed) {
        // Already SCIM-managed — true duplicate, return 409
        throw new HttpException(
          {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: 'User already exists in organization',
            status: '409',
          },
          409,
        );
      }

      // Convert existing user to SCIM-managed, preserve existing role
      const updateData: Partial<OrgUser> = {
        scim_external_id: scimId,
        scim_managed: true,
        scim_user_name: scimUser.userName,
        scim_meta: scimMeta,
      };

      // Only override role if explicitly provided in SCIM extension
      if (extensionRole) {
        updateData.roles = extensionRole;
      }

      const adoptedUser = await OrgUser.update(
        existingOrgUser.fk_user_id,
        orgId,
        updateData,
      );

      return this.toScimUser(adoptedUser);
    }

    // Default role: SCIM extension > config default_role > viewer
    const scimConfig = await ScimConfig.get(context, orgId);
    const configDefaultRole = scimConfig?.default_role as EnterpriseOrgUserRoles | undefined;
    const orgRole =
      extensionRole || configDefaultRole || EnterpriseOrgUserRoles.VIEWER;

    // Reactivate soft-deleted user
    if (existingOrgUser?.deleted) {
      const updateData: Partial<OrgUser> = {
        deleted: false,
        deleted_at: null,
        roles: orgRole,
        scim_external_id: scimId,
        scim_managed: true,
        scim_user_name: scimUser.userName,
        scim_meta: scimMeta,
      };

      const reactivatedUser = await OrgUser.update(
        existingOrgUser.fk_user_id,
        orgId,
        updateData,
      );

      this.emitScimEvent(AppEvents.SCIM_USER_REACTIVATE, {
        orgId,
        user,
        orgUser: reactivatedUser,
        scimId,
        req: param.req,
      });

      return this.toScimUser(reactivatedUser);
    }

    // Create new org user with SCIM data
    const orgUser = await OrgUser.insert({
      fk_org_id: orgId,
      fk_user_id: user.id,
      roles: orgRole,
      scim_external_id: scimId,
      scim_managed: true,
      scim_user_name: scimUser.userName,
      scim_meta: scimMeta,
    });

    // Re-fetch with user data joined for complete response
    const fullOrgUser = await OrgUser.get(orgId, user.id, {
      include_deleted: false,
    });

    this.emitScimEvent(AppEvents.SCIM_USER_PROVISION, {
      orgId,
      user,
      orgUser: fullOrgUser || orgUser,
      scimId,
      req: param.req,
    });

    return this.toScimUser(fullOrgUser || orgUser);
  }

  /**
   * Update user (PUT - full replacement)
   */
  async replaceUser(
    context: NcContext,
    param: {
      orgId: string;
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
      orgId: string;
      scimId: string;
      scimUser: Record<string, any>;
      req: NcRequest;
    },
  ) {
    const { scimUser } = param;

    // If the body contains Operations array, parse it into a flat user object
    if (scimUser.Operations) {
      const flatUser: Record<string, any> = {};
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
            // Handle NocoDB extension path (e.g. "urn:...:User:orgRole")
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
    _context: NcContext,
    param: {
      orgId: string;
      scimId: string;
      scimUser: Record<string, any>;
      isPatch: boolean;
      req: NcRequest;
    },
  ) {
    const { orgId, scimId, scimUser } = param;

    // Direct indexed lookup (include deleted so we can reactivate them)
    const orgUser = await OrgUser.getByScimExternalId(
      orgId,
      scimId,
      { include_deleted: true },
    );

    if (!orgUser) {
      NcError.notFound('User not found');
    }

    // Detect email change — email is immutable in NocoDB.
    // If the IdP changed the email, soft-delete the old user and create a new one.
    const newEmail = this.extractEmail(scimUser) || scimUser.userName;
    if (newEmail) {
      const currentUser = await User.get(orgUser.fk_user_id);
      if (currentUser && currentUser.email !== newEmail) {
        // Soft-delete old org user
        await OrgUser.softDelete(orgId, currentUser.id);
        // Preserve IdP externalId from scim_meta for the new user
        const existingMeta = (orgUser.scim_meta as Record<string, any>) || {};
        const idpExternalId = scimUser.externalId || existingMeta.externalId;
        // Create fresh user with new email via the createUser flow
        return this.createUser(_context, {
          orgId,
          scimUser: {
            ...scimUser,
            ...(idpExternalId ? { externalId: idpExternalId } : {}),
          },
          req: param.req,
        });
      }
    }

    // Build update object
    const existingMeta = (orgUser.scim_meta as Record<string, any>) || {};
    const updateData: Partial<OrgUser> = {
      scim_meta: {
        ...existingMeta,
      },
    };

    // Update active status in meta
    if (scimUser.active !== undefined) {
      (updateData.scim_meta as Record<string, any>).active =
        scimUser.active !== false;
    }

    if (scimUser.userName !== undefined) {
      updateData.scim_user_name = scimUser.userName;
    }

    // For PUT (full replacement), rebuild all meta from the incoming SCIM user
    if (!param.isPatch) {
      updateData.scim_meta = this.buildScimMeta(scimUser);
    } else {
      // For PATCH, merge individual fields into existing meta
      this.mergeScimMetaFromPatch(
        updateData.scim_meta as Record<string, any>,
        scimUser,
      );
    }

    // Handle org role from NocoDB extension attribute
    const newRole = this.extractOrgRole(scimUser);
    if (newRole) {
      updateData.roles = newRole;
    }

    // Handle active status (deactivation)
    const isDeactivating = scimUser.active === false && !orgUser.deleted;
    if (scimUser.active === false) {
      updateData.deleted = true;
      updateData.deleted_at = new Date().toISOString();
    } else if (scimUser.active === true && orgUser.deleted) {
      updateData.deleted = false;
      updateData.deleted_at = null;
    }

    // Persist the update
    await OrgUser.update(
      orgUser.fk_user_id,
      orgId,
      updateData,
    );

    // Determine reactivation before cleanup (orgUser.deleted is pre-update state)
    const isReactivating =
      scimUser.active === true && orgUser.deleted && !isDeactivating;

    if (isDeactivating) {
      this.emitScimEvent(AppEvents.SCIM_USER_DEACTIVATE, {
        orgId,
        userId: orgUser.fk_user_id,
        orgUser,
        scimId,
        req: param.req,
      });
    } else if (isReactivating) {
      this.emitScimEvent(AppEvents.SCIM_USER_REACTIVATE, {
        orgId,
        userId: orgUser.fk_user_id,
        orgUser,
        scimId,
        req: param.req,
      });
    } else {
      this.emitScimEvent(AppEvents.SCIM_USER_UPDATE, {
        orgId,
        userId: orgUser.fk_user_id,
        orgUser,
        scimId,
        req: param.req,
      });
    }

    // Re-fetch from DB via getByScimExternalId (same code path as GET)
    // to ensure response reflects persisted state and scim_meta is parsed
    const refreshed = await OrgUser.getByScimExternalId(
      orgId,
      scimId,
      { include_deleted: true },
    );

    if (refreshed) {
      return this.toScimUser(refreshed);
    }

    // Fallback for edge cases (e.g. race condition on deactivation)
    return this.toScimUser({ ...orgUser, ...updateData });
  }

  /**
   * Deactivate user (SCIM DELETE = soft delete)
   */
  async deactivateUser(
    _context: NcContext,
    param: { orgId: string; scimId: string; req: NcRequest },
  ) {
    // Direct indexed lookup (include deleted so we can distinguish not-found vs already-deleted)
    const orgUser = await OrgUser.getByScimExternalId(
      param.orgId,
      param.scimId,
      { include_deleted: true },
    );

    // RFC 7644 §3.6: Return 404 if the resource does not exist
    if (!orgUser) {
      NcError.notFound('User not found');
    }

    // Already deactivated — return 404 (Microsoft SCIM compliance requires
    // 404 for DELETE on an already-deleted resource)
    if (orgUser.deleted) {
      NcError.notFound('User not found');
    }

    await OrgUser.softDelete(param.orgId, orgUser.fk_user_id);

    this.emitScimEvent(AppEvents.SCIM_USER_DELETE, {
      orgId: param.orgId,
      userId: orgUser.fk_user_id,
      orgUser,
      scimId: param.scimId,
      req: param.req,
    });
  }

  /**
   * Build comprehensive scim_meta from incoming SCIM user data.
   * Stores ALL SCIM attributes for round-tripping.
   */
  private buildScimMeta(scimUser: Record<string, any>): Record<string, any> {
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
  private mergeScimMetaFromPatch(
    meta: Record<string, any>,
    patchData: Record<string, any>,
  ) {
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
      if (
        !emailValue ||
        (typeof emailValue === 'string' && !emailValue.trim())
      ) {
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
    meta: Record<string, any>,
    attrName: string,
    typeValue: string | null,
    patchData: Record<string, any>,
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
   * Find an org user by the IdP's externalId.
   */
  private async findOrgUserByIdpExternalId(
    orgId: string,
    idpExternalId: string,
  ): Promise<any | null> {
    return OrgUser.getByScimExternalId(orgId, idpExternalId);
  }

  /**
   * Convert OrgUser to SCIM User format with full attribute round-tripping
   */
  private async toScimUser(orgUser: any): Promise<Record<string, any>> {
    // Parse scim_meta if it's a JSON string
    let rawMeta = orgUser.scim_meta;
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

    const result: Record<string, any> = {
      schemas,
      id: orgUser.scim_external_id,
      // externalId is optional (RFC 7643 §3.1); omit rather than null to
      // satisfy the schema constraint that it must be a string when present
      ...(scimMeta.externalId ? { externalId: scimMeta.externalId } : {}),
      userName: orgUser.scim_user_name || orgUser.email,
      name:
        scimMeta.name ||
        (orgUser.display_name
          ? { formatted: orgUser.display_name }
          : {}),
      displayName:
        scimMeta.displayName ||
        orgUser.display_name ||
        orgUser.scim_user_name ||
        orgUser.email,
      emails: scimMeta.emails || [
        {
          value: orgUser.email,
          type: 'work',
          primary: true,
        },
      ],
      active: !orgUser.deleted && scimMeta.active !== false,
      meta: {
        resourceType: 'User',
        location: `/scim/v2/Users/${orgUser.scim_external_id}`,
        ...(orgUser.created_at
          ? { created: new Date(orgUser.created_at).toISOString() }
          : {}),
        ...(orgUser.updated_at
          ? { lastModified: new Date(orgUser.updated_at).toISOString() }
          : orgUser.created_at
          ? { lastModified: new Date(orgUser.created_at).toISOString() }
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

    // Add NocoDB User extension (orgRole)
    const orgRoleLabel = ORG_ROLE_TO_LABEL[orgUser.roles];
    if (orgRoleLabel) {
      result.schemas.push(NOCODB_USER_EXTENSION);
      result[NOCODB_USER_EXTENSION] = { orgRole: orgRoleLabel };
    }

    return result;
  }

  /**
   * Emit a SCIM audit event asynchronously (fire-and-forget).
   * Fetches org + user objects needed for the audit payload.
   */
  private emitScimEvent(
    event:
      | AppEvents.SCIM_USER_PROVISION
      | AppEvents.SCIM_USER_UPDATE
      | AppEvents.SCIM_USER_DEACTIVATE
      | AppEvents.SCIM_USER_REACTIVATE
      | AppEvents.SCIM_USER_DELETE,
    param: {
      orgId: string;
      user?: UserType;
      userId?: string;
      orgUser: Partial<OrgUser>;
      scimId: string;
      req: NcRequest;
    },
  ) {
    // Fire-and-forget: resolve org + user then emit
    Promise.all([
      Org.get(param.orgId),
      param.user
        ? Promise.resolve(param.user)
        : User.get(param.userId || param.orgUser.fk_user_id),
    ])
      .then(([org, user]) => {
        if (!org || !user) return;
        this.appHooksService.emit(event, {
          org,
          user,
          orgUser: param.orgUser,
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
  private extractEmail(scimUser: Record<string, any>): string | null {
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
