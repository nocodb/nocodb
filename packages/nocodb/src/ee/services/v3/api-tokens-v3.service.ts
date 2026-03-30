import { Injectable, Logger } from '@nestjs/common';
import {
  ApiTokenPermissionCategory,
  ApiTokenPermissionLevel,
  AppEvents,
  extractRolesObj,
  NcApiVersion,
  OrgUserRoles,
} from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
import type {
  ApiTokensV3CreateRequest,
  ApiTokensV3ListResponse,
  ApiTokensV3Scope,
  ApiTokensV3UpdateRequest,
  ApiTokensV3WithToken,
} from '~/services/v3/api-tokens-v3.type';
import { OrgTokensService } from '~/services/org-tokens.service';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { WorkspacesService } from '~/services/workspaces.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ApiToken, ApiTokenScope, Base, User } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';

@Injectable()
export class ApiTokensV3Service {
  protected readonly logger = new Logger(ApiTokensV3Service.name);

  constructor(
    private readonly orgTokensService: OrgTokensService,
    private readonly orgTokensEeService: OrgTokensEeService,
    private readonly workspaceService: WorkspacesService,
    private readonly appHooksService: AppHooksService,
  ) {}

  async validateRequestor(param: { cookie: NcRequest }) {
    // On cloud, require enterprise plan (workspace must belong to an org)
    if (process.env.NC_CLOUD === 'true') {
      const result = await this.workspaceService.list({
        user: param.cookie.user,
      });
      if (!result.list.some((ws) => !!(ws as Record<string, any>).fk_org_id)) {
        NcError.get({ api_version: NcApiVersion.V3 }).forbidden(
          `Accessing api token api require enterprise plan`,
        );
      }
    }
  }

  /**
   * Extract non-none permission category names from scopes for audit/telemetry.
   * Never includes token values or hashes.
   */
  private extractPermissionCategories(
    scopes?: Array<{ permissions?: Record<string, string> }>,
  ): string[] {
    if (!scopes?.length) return [];
    const perms = scopes[0]?.permissions;
    if (!perms) return [];
    return Object.entries(perms)
      .filter(([_, level]) => level !== 'none')
      .map(([category]) => category);
  }

  private async transformToV3(
    apiToken: Record<string, any>,
  ): Promise<Partial<ApiTokensV3WithToken>> {
    const result: Partial<ApiTokensV3WithToken> = {
      id: apiToken.id,
      title: apiToken.description,
      created_at: apiToken.created_at,
      updated_at: apiToken.updated_at,
    };

    // Load scopes from the join table
    const scopes =
      apiToken.scopes || (await ApiTokenScope.listByTokenId(apiToken.id));
    if (scopes?.length) {
      result.scopes = scopes.map((s) => {
        const scope: ApiTokensV3Scope = {
          id: s.id,
          resource_type: s.resource_type,
          resource_id: s.resource_id,
        };
        if (s.permissions) {
          try {
            const parsed =
              typeof s.permissions === 'string'
                ? JSON.parse(s.permissions)
                : s.permissions;
            scope.permissions = parsed?.categories || parsed;
          } catch {
            // skip
          }
        }
        return scope;
      });
    }

    if (apiToken.token_prefix) {
      result.token_prefix = apiToken.token_prefix;
    }
    if (apiToken.expiry !== undefined) {
      result.expiry = apiToken.expiry;
    }
    if (apiToken.enabled !== undefined) {
      result.enabled = apiToken.enabled;
    }
    if (apiToken.last_used_at) {
      result.last_used_at = apiToken.last_used_at;
    }

    // Include token only in create response
    if (apiToken.token) {
      result.token = apiToken.token;
    }

    return result;
  }

  private static readonly VALID_PERMISSION_LEVELS = new Set(
    Object.values(ApiTokenPermissionLevel),
  );

  private static readonly VALID_PERMISSION_CATEGORIES = new Set(
    Object.values(ApiTokenPermissionCategory),
  );

  private validateTitle(title?: string) {
    if (title !== undefined && !title?.trim()) {
      NcError.badRequest('Token title is required');
    }
    if (title && title.length > 255) {
      NcError.badRequest('Token title must be 255 characters or less');
    }
  }

  private validatePermissions(permissions?: Record<string, string>) {
    if (!permissions) return;

    for (const [category, level] of Object.entries(permissions)) {
      if (!ApiTokensV3Service.VALID_PERMISSION_CATEGORIES.has(category as ApiTokenPermissionCategory)) {
        NcError.badRequest(
          `Invalid permission category: '${category}'. Valid categories: ${[...ApiTokensV3Service.VALID_PERMISSION_CATEGORIES].join(', ')}`,
        );
      }
      if (!ApiTokensV3Service.VALID_PERMISSION_LEVELS.has(level as ApiTokenPermissionLevel)) {
        NcError.badRequest(
          `Invalid permission level: '${level}' for category '${category}'. Valid levels: none, read, write`,
        );
      }
    }
  }

  private async validateScopes(
    scopes?: ApiTokensV3CreateRequest['scopes'],
    userId?: string,
  ) {
    if (!scopes?.length) return;

    if (scopes.length > 100) {
      NcError.badRequest('Maximum 100 scopes per token');
    }

    for (const scope of scopes) {
      if (!scope.resource_type || !scope.resource_id) {
        NcError.badRequest(
          'Each scope must have resource_type and resource_id',
        );
      }

      this.validatePermissions(scope.permissions as Record<string, string>);

      if (scope.resource_type === 'base') {
        const base = await Base.get(
          { workspace_id: 'bypass', base_id: 'bypass' },
          scope.resource_id,
        );
        if (!base) {
          NcError.badRequest('Invalid or inaccessible resource in scope');
        }

        // Verify the user has access to this base
        if (userId && base) {
          const userWithRoles = await User.getWithRoles(
            { workspace_id: base.fk_workspace_id, base_id: base.id },
            userId,
            { baseId: base.id },
          );
          if (!userWithRoles?.base_roles) {
            NcError.badRequest('Invalid or inaccessible resource in scope');
          }
        }
      } else if (scope.resource_type === 'workspace') {
        if (userId) {
          const userWithRoles = await User.getWithRoles(
            { workspace_id: scope.resource_id, base_id: null },
            userId,
            {},
          );
          if (!userWithRoles?.workspace_roles) {
            NcError.badRequest('Invalid or inaccessible resource in scope');
          }
        }
      } else {
        NcError.badRequest('Invalid resource type in scope');
      }
    }
  }

  private validateExpiry(expiry?: string) {
    if (!expiry) return;

    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate.getTime())) {
      NcError.badRequest('Invalid expiry date format');
    }
    if (expiryDate <= new Date()) {
      NcError.badRequest('Expiry date must be in the future');
    }
  }

  async list(param: { cookie: NcRequest }) {
    await this.validateRequestor(param);
    const result = await this.orgTokensEeService.apiTokenListEE({
      query: param.cookie.query,
      user: param.cookie['user'],
    });

    // Batch-load scopes for all tokens in one query to avoid N+1
    const tokenIds = result.list.map((t: Record<string, any>) => t.id).filter(Boolean);
    const scopesByTokenId = tokenIds.length
      ? await ApiTokenScope.listByTokenIds(tokenIds)
      : {};

    const list = [];
    for (const apiT of result.list) {
      (apiT as Record<string, any>).scopes = scopesByTokenId[apiT.id] || [];
      const v3Token = await this.transformToV3(apiT);
      delete v3Token.token;
      list.push(v3Token);
    }

    return { list, pageInfo: result.pageInfo } as ApiTokensV3ListResponse;
  }

  async create(param: { cookie: NcRequest; body: ApiTokensV3CreateRequest }) {
    await this.validateRequestor(param);

    this.validateTitle(param.body.title);

    // On licensed EE (Cloud + on-prem licensed), fine-grained tokens require
    // at least one access scope. On CE / unlicensed on-prem, tokens are org-wide
    // by default (no scope selection UI).
    if (Noco.isEE() && !param.body.scopes?.length) {
      NcError.badRequest(
        'At least one access scope is required. Use "Add all resources" for org-wide access or select specific bases.',
      );
    }

    // resource_type: 'all' is a sentinel from the UI meaning "org-wide access" —
    // filter it out before validation/insertion (no scope rows = org-wide in the auth strategy)
    const scopesForStorage = (param.body.scopes || []).filter(
      (s) => (s.resource_type as string) !== 'all',
    );

    await this.validateScopes(scopesForStorage, param.cookie['user']?.id);
    this.validateExpiry(param.body.expiry);

    const ssoClientId = (param.cookie.user as Record<string, any>)?.extra
      ?.sso_client_id;

    const result = await ApiToken.insert({
      description: param.body.title,
      fk_user_id: param.cookie['user'].id,
      fk_sso_client_id: ssoClientId || null,
      scopes: scopesForStorage as any,
      expiry: param.body.expiry || null,
      fineGrained: true,
    });

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_CREATE, {
      tokenTitle: result.description,
      userId: param.cookie['user']?.id,
      tokenId: result.id,
      scopeCount: param.body.scopes?.length || 0,
      permissionCategories: this.extractPermissionCategories(param.body.scopes),
      hasExpiry: !!param.body.expiry,
      req: param.cookie,
    });

    return (await this.transformToV3(result)) as ApiTokensV3WithToken;
  }

  async update(param: {
    id: string;
    cookie: NcRequest;
    body: ApiTokensV3UpdateRequest;
  }) {
    await this.validateRequestor(param);

    const user = param.cookie['user'];
    const apiToken = await ApiToken.get(param.id);

    if (!apiToken) {
      NcError.notFound('Token not found');
    }

    if (
      !extractRolesObj(user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== user.id
    ) {
      NcError.notFound('Token not found');
    }

    const updateData: Record<string, any> = {};

    if (param.body.title !== undefined) {
      this.validateTitle(param.body.title);
      updateData.description = param.body.title;
    }
    if (param.body.expiry !== undefined) {
      if (param.body.expiry === null) {
        updateData.expiry = null;
      } else {
        this.validateExpiry(param.body.expiry);
        updateData.expiry = param.body.expiry;
      }
    }
    if (param.body.enabled !== undefined) {
      updateData.enabled = param.body.enabled;
    }

    // Validate scopes before transaction
    let scopesForUpdate: typeof param.body.scopes | undefined;
    if (param.body.scopes !== undefined) {
      scopesForUpdate = param.body.scopes.filter(
        (s) => (s.resource_type as string) !== 'all',
      );
      await this.validateScopes(scopesForUpdate, user?.id);
    }

    // Wrap metadata update + scope replacement in one transaction
    const hasMetadataUpdate = Object.keys(updateData).length > 0;
    const hasScopeUpdate = scopesForUpdate !== undefined;

    if (hasMetadataUpdate || hasScopeUpdate) {
      const trx = await Noco.ncMeta.startTransaction();
      try {
        if (hasMetadataUpdate) {
          await ApiToken.update(param.id, updateData, trx);
        }
        if (hasScopeUpdate) {
          await ApiTokenScope.deleteByTokenId(param.id, trx);
          if (scopesForUpdate.length) {
            await ApiTokenScope.bulkInsert(param.id, scopesForUpdate, trx);
          }
        }
        await trx.commit();
      } catch (e) {
        await trx.rollback(e);
        throw e;
      }
    }

    const updated = await ApiToken.get(param.id);

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_UPDATE, {
      tokenId: param.id,
      tokenTitle: updated?.description,
      userId: user?.id,
      scopeCount: param.body.scopes?.length,
      permissionCategories: this.extractPermissionCategories(param.body.scopes),
      hasExpiry: param.body.expiry !== undefined,
      req: param.cookie,
    });

    const result = await this.transformToV3(updated);
    // Never leak full token in update response
    delete result.token;
    return result;
  }

  async delete(param: { id: string; cookie: NcRequest }) {
    await this.validateRequestor(param);

    const user = param.cookie['user'];
    const token = await ApiToken.get(param.id);

    // Scope cleanup is handled by ApiToken.delete() (called inside apiTokenDelete)
    // after ownership is verified — do not delete scopes here before the check.
    await this.orgTokensService.apiTokenDelete({
      tokenId: param.id,
      user,
      req: param.cookie,
    });

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_DELETE, {
      tokenId: param.id,
      tokenTitle: token?.description,
      userId: user?.id,
      req: param.cookie,
    });

    return { deleted: true };
  }
}
