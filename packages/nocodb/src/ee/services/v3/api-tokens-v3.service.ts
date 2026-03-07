import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  NcApiVersion,
  OrgUserRoles,
} from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
import type {
  ApiTokensV3CreateRequest,
  ApiTokensV3ListResponse,
  ApiTokensV3UpdateRequest,
  ApiTokensV3WithToken,
} from '~/services/v3/api-tokens-v3.type';
import { OrgTokensService } from '~/services/org-tokens.service';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { WorkspacesService } from '~/services/workspaces.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ApiToken, ApiTokenScope, Base } from '~/models';
import { NcError } from '~/helpers/catchError';

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
    const result = await this.workspaceService.list({
      user: param.cookie.user,
    });
    if (!result.list.some((ws: any) => !!ws.fk_org_id)) {
      NcError.get({ api_version: NcApiVersion.V3 }).forbidden(
        `Accessing api token api require enterprise plan`,
      );
    }
  }

  private async transformToV3(apiToken: any): Promise<any> {
    const result: any = {
      id: apiToken.id,
      title: apiToken.description,
      created_at: apiToken.created_at,
      updated_at: apiToken.updated_at,
    };

    // Load scopes from the join table
    const scopes = apiToken.scopes || (await ApiTokenScope.listByTokenId(apiToken.id));
    if (scopes?.length) {
      result.scopes = scopes.map((s: any) => {
        const scope: any = {
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

  private async validateScopes(
    scopes?: ApiTokensV3CreateRequest['scopes'],
  ) {
    if (!scopes?.length) return;

    for (const scope of scopes) {
      if (!scope.resource_type || !scope.resource_id) {
        NcError.badRequest(
          'Each scope must have resource_type and resource_id',
        );
      }

      if (scope.resource_type === 'base') {
        const base = await Base.get(
          { workspace_id: 'bypass', base_id: 'bypass' },
          scope.resource_id,
        );
        if (!base) {
          NcError.badRequest(`Base not found: ${scope.resource_id}`);
        }
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

    const list = [];
    for (const apiT of result.list) {
      const v3Token = await this.transformToV3(apiT);
      delete v3Token.token;
      list.push(v3Token);
    }

    return { list } as ApiTokensV3ListResponse;
  }

  async create(param: { cookie: NcRequest; body: ApiTokensV3CreateRequest }) {
    await this.validateRequestor(param);

    await this.validateScopes(param.body.scopes);
    this.validateExpiry(param.body.expiry);

    const ssoClientId = (param.cookie.user as any)?.extra?.sso_client_id;

    const result = await ApiToken.insert({
      description: param.body.title,
      fk_user_id: param.cookie['user'].id,
      fk_sso_client_id: ssoClientId || null,
      scopes: param.body.scopes,
      expiry: param.body.expiry || null,
    });

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_CREATE, {
      tokenTitle: result.description,
      userId: param.cookie['user']?.id,
      tokenId: result.id,
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
      updateData.description = param.body.title;
    }
    if (param.body.expiry !== undefined) {
      this.validateExpiry(param.body.expiry || undefined);
      updateData.expiry = param.body.expiry;
    }
    if (param.body.enabled !== undefined) {
      updateData.enabled = param.body.enabled;
    }

    if (Object.keys(updateData).length) {
      await ApiToken.update(param.id, updateData);
    }

    // Update scopes if provided
    if (param.body.scopes !== undefined) {
      await this.validateScopes(param.body.scopes);
      // Replace all scopes — delete existing, insert new
      await ApiTokenScope.deleteByTokenId(param.id);
      if (param.body.scopes.length) {
        await ApiTokenScope.bulkInsert(param.id, param.body.scopes);
      }
    }

    const updated = await ApiToken.get(param.id);

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_UPDATE, {
      tokenId: param.id,
      tokenTitle: updated?.description,
      userId: user?.id,
      req: param.cookie,
    });

    return this.transformToV3(updated);
  }

  async delete(param: { id: string; cookie: NcRequest }) {
    await this.validateRequestor(param);

    // Delete associated scopes first
    await ApiTokenScope.deleteByTokenId(param.id);

    await this.orgTokensService.apiTokenDelete({
      tokenId: param.id,
      user: param.cookie['user'],
      req: param.cookie,
    });
    return { deleted: true };
  }
}
