import { Injectable } from '@nestjs/common';
import { NcBaseError, ProjectRoles } from 'nocodb-sdk';
import type { ApiTokenScopeEntry, NcContext } from 'nocodb-sdk';
import {
  Base,
  OAuthAuthorizationCode,
  OAuthClient,
  User,
  WorkspaceUser,
} from '~/models';
import { NcError } from '~/helpers/ncError';
import {
  isHttpRedirectUri,
  isRegisteredRedirectUri,
} from '~/modules/oauth/helpers/redirectUri';
import { hasMinimumRole } from '~/utils/roleHelper';

@Injectable()
export class OauthAuthorizationService {
  // Authorization code expires in 10 minutes
  private readonly AUTHORIZATION_CODE_EXPIRES_IN_MS = 10 * 60 * 1000;

  /**
   * Resolve the client and exact-match `redirectUri` against its registered
   * list.
   *
   * RFC 6749 §4.1.2.1: an unregistered redirect_uri must NOT be redirected to.
   * That makes this a precondition of *every* redirect the authorize endpoint
   * builds — the approve path, the user-denied path and the server_error path
   * alike — not just of minting a code. Callers must invoke it before building
   * any redirect, and outside any try/catch that would convert the rejection
   * into a redirect.
   */
  async assertRegisteredRedirectUri(clientId: string, redirectUri: string) {
    const client = await OAuthClient.getByClientId(clientId);
    if (!client) {
      NcError.badRequest('invalid_client');
    }

    // Re-checks the scheme as well as the exact match — `z.string().url()`
    // accepted opaque schemes at registration time on older clients, so the
    // stored list isn't trusted.
    if (!isRegisteredRedirectUri(client.redirect_uris, redirectUri)) {
      NcError.badRequest('invalid_redirect_uri');
    }

    return client;
  }

  buildRedirectUrl(redirectUri: string, params: Record<string, string>) {
    // Single choke point for every caller: deny path, approve path, and the
    // controller's catch block. Only the scheme is re-checked here — the
    // registered-URI match happens in `assertRegisteredRedirectUri`, which the
    // caller must run before it reaches any of those branches.
    if (!isHttpRedirectUri(redirectUri)) {
      NcError.badRequest('invalid_redirect_uri');
    }

    const url = new URL(redirectUri);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }

  /**
   * CE records no scopes on a consent: there is no scope model to record.
   */
  protected async buildConsentPermissions(_params: {
    scopes?: ApiTokenScopeEntry[];
    tools?: string[];
    userId: string;
    scope?: string;
  }): Promise<string | null> {
    return null;
  }

  async createAuthorizationCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    scope?: string;
    workspaceId?: string;
    baseId?: string;
    resource?: string;
    scopes?: ApiTokenScopeEntry[];
    tools?: string[];
  }): Promise<OAuthAuthorizationCode> {
    const {
      clientId,
      userId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod = 'S256',
      scope,
      workspaceId,
      baseId,
      resource,
      scopes,
      tools,
    } = params;

    // Validate the client and that the redirect URI is one it registered. Also
    // run by the controller before any redirect is built — kept here too so the
    // code-minting path is never reachable without it.
    await this.assertRegisteredRedirectUri(clientId, redirectUri);

    // RFC 6749 Appendix A.5: state = 1*VSCHAR (printable ASCII 0x20-0x7E).
    // Max matches the `state` column width; the RFC sets no minimum.
    if (state) {
      if (state.length > 1024 || !/^[\x20-\x7E]+$/.test(state)) {
        NcError.badRequest('invalid_state');
      }
    }

    // Validate code challenge inline
    if (!codeChallenge) {
      NcError.badRequest('code_challenge_required');
    }

    if (codeChallengeMethod !== 'S256') {
      NcError.badRequest('invalid_code_challenge');
    }

    if (codeChallenge.length !== 43) {
      NcError.badRequest('invalid_code_challenge');
    }

    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    if (!base64urlPattern.test(codeChallenge)) {
      NcError.badRequest('invalid_code_challenge');
    }

    // The two consent shapes are mutually exclusive: a base pin grants the
    // user's full authority over that base, scopes grant only what they name.
    // Stored together they are honoured inconsistently — `/api/v3/` reads the
    // blob, `/mcp` takes the pin — so the grant would mean two things at once.
    if (baseId && scopes?.length) {
      NcError.badRequest(
        'A consent may name a base or a set of scopes, not both.',
      );
    }

    const expiresAt = new Date(
      Date.now() + this.AUTHORIZATION_CODE_EXPIRES_IN_MS,
    );

    const grantedResources: Record<string, any> = {};

    // Validate workspace access if specified
    if (workspaceId) {
      try {
        const wsUser = await WorkspaceUser.get(workspaceId, userId);

        if (!wsUser) {
          NcError.forbidden(
            'User does not have access to the specified workspace',
          );
        }

        grantedResources.workspace_id = workspaceId;
      } catch (error) {
        if (error instanceof NcError || error instanceof NcBaseError)
          throw error;
        NcError.badRequest('invalid_workspace_id');
      }
    }

    // Validate base access if specified
    if (baseId) {
      try {
        const context = {
          workspace_id: workspaceId,
          base_id: baseId,
        } as NcContext;

        // Effective role, not a base-membership row: a workspace owner holds no
        // `nc_bases_users` row yet owns every regular base in the workspace.
        // Same check `/mcp` applies per call, so consent cannot be stricter
        // than the surface it grants.
        const userWithRoles = await User.getWithRoles(context, userId, {
          baseId,
          workspaceId,
        });

        if (!hasMinimumRole(userWithRoles, ProjectRoles.VIEWER)) {
          NcError.forbidden('User does not have access to the specified base');
        }

        const base = await Base.get(context, baseId);

        if (!base) {
          NcError.forbidden('User does not have access to the specified base');
        }

        // If workspace is specified, ensure base belongs to that workspace
        if (workspaceId && base.fk_workspace_id !== workspaceId) {
          NcError.badRequest('Base does not belong to the specified workspace');
        }

        grantedResources.base_id = baseId;
      } catch (error) {
        if (error instanceof NcError || error instanceof NcBaseError)
          throw error;
        NcError.badRequest('invalid_base_id');
      }
    }

    return await OAuthAuthorizationCode.insert({
      fk_client_id: clientId,
      fk_user_id: userId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
      resource,
      granted_resources:
        Object.keys(grantedResources).length > 0 ? grantedResources : null,
      expires_at: expiresAt.toISOString(),
      permissions: await this.buildConsentPermissions({
        scopes,
        tools,
        userId,
        scope,
      }),
    });
  }
}
