import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { NcBaseErrorv2, NcErrorType, NcRequest } from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';

const logger = new Logger('OAuthV3Controller');

const OAUTH_ERROR_CODE_MAP: Partial<Record<NcErrorType, string>> = {
  [NcErrorType.ERR_OAUTH_INVALID_CLIENT]: 'invalid_client',
  [NcErrorType.ERR_OAUTH_INVALID_GRANT]: 'invalid_grant',
  [NcErrorType.ERR_OAUTH_INVALID_REQUEST]: 'invalid_request',
};

@Controller()
export class OAuthV3Controller {
  constructor(
    protected readonly oauthAuthorizationService: OauthAuthorizationService,
    protected readonly oauthTokenService: OauthTokenService,
    protected readonly oauthClientService: OauthClientService,
  ) {}

  // ─── Protocol Endpoints (public) ───────────────────────────────────

  @Get('/api/v3/oauth/authorize')
  @UseGuards(PublicApiLimiterGuard)
  async authorizeRedirect(@Req() req: NcRequest, @Res() res: Response) {
    const queryParams = new URLSearchParams(req.query).toString();
    const redirectUrl = `${req.ncSiteUrl}/oauth/authorize${
      queryParams ? '?' + queryParams : ''
    }`;

    return res.redirect(redirectUrl);
  }

  @Post('/api/v3/oauth/authorize')
  @HttpCode(200)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async authorize(@Body() body, @Req() req: NcRequest) {
    const {
      client_id,
      redirect_uri,
      state,
      approved,
      code_challenge,
      code_challenge_method,
      scope,
      workspace_id,
      base_id,
      resource,
    } = body;

    if (!client_id || !redirect_uri) {
      NcError.badRequest(
        'Missing required parameters: client_id, redirect_uri',
      );
    }

    try {
      if (!approved) {
        const errorRedirectUrl =
          this.oauthAuthorizationService.buildRedirectUrl(redirect_uri, {
            error: 'access_denied',
            error_description: 'User denied the request',
            ...(state && { state }),
          });
        return { redirect_url: errorRedirectUrl };
      }

      const authCode =
        await this.oauthAuthorizationService.createAuthorizationCode({
          clientId: client_id,
          userId: req.user.id,
          redirectUri: redirect_uri,
          state,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
          scope,
          workspaceId: workspace_id,
          baseId: base_id,
          resource,
        });

      const successRedirectUrl =
        this.oauthAuthorizationService.buildRedirectUrl(redirect_uri, {
          code: authCode.code,
          ...(state && { state }),
        });
      return { redirect_url: successRedirectUrl };
    } catch (e) {
      logger.error(e?.message, e);
      const errorRedirectUrl = this.oauthAuthorizationService.buildRedirectUrl(
        redirect_uri,
        {
          error: 'server_error',
          error_description: 'Authorization server encountered an error',
          ...(state && { state }),
        },
      );

      return { redirect_url: errorRedirectUrl };
    }
  }

  @Post('/api/v3/oauth/token')
  @HttpCode(200)
  @UseGuards(PublicApiLimiterGuard)
  async token(
    @Body() body,
    @Headers('content-type') contentType: string,
    @Res() res: Response,
  ) {
    if (
      !contentType ||
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description:
          'Content-Type must be application/x-www-form-urlencoded',
      });
    }

    const {
      grant_type,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
      resource,
      client_id: clientId,
      client_secret: clientSecret,
    } = body;

    if (!grant_type) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameter: grant_type',
      });
    }

    try {
      let result;
      switch (grant_type) {
        case 'authorization_code':
          if (!code || !redirect_uri) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description:
                'Missing required parameters: code, redirect_uri',
            });
          }

          if (!code_verifier) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: 'Missing required parameter: code_verifier',
            });
          }

          result = await this.oauthTokenService.exchangeCodeForTokens({
            code,
            redirectUri: redirect_uri,
            codeVerifier: code_verifier,
            clientSecret,
            resource,
            api_version: 3,
          });
          return res.status(200).json(result);

        case 'refresh_token':
          if (!refresh_token) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: 'Missing required parameter: refresh_token',
            });
          }

          if (!clientId && !clientSecret) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: 'Missing required parameter: client_id',
            });
          }

          result = await this.oauthTokenService.refreshAccessToken({
            refreshToken: refresh_token,
            clientId,
            clientSecret,
            resource,
            api_version: 3,
          });
          return res.status(200).json(result);

        default:
          return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: `Unsupported grant_type: ${grant_type}`,
          });
      }
    } catch (error) {
      if (error instanceof NcBaseErrorv2 && OAUTH_ERROR_CODE_MAP[error.error]) {
        return res.status(error.code).json({
          error: OAUTH_ERROR_CODE_MAP[error.error],
          error_description: error.message,
        });
      }

      logger.error('oauth_token_error', error);
      return res.status(500).json({
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      });
    }
  }

  @Post('/api/v3/oauth/revoke')
  @HttpCode(200)
  @UseGuards(PublicApiLimiterGuard)
  async revoke(
    @Body() body,
    @Headers('content-type') contentType: string,
    @Res() res: Response,
  ) {
    if (
      !contentType ||
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description:
          'Content-Type must be application/x-www-form-urlencoded',
      });
    }

    const {
      token,
      token_type_hint,
      client_id: clientId,
      client_secret: clientSecret,
    } = body;

    if (!token || !clientId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: token, client_id',
      });
    }

    try {
      await this.oauthTokenService.revokeToken({
        token,
        clientId,
        clientSecret,
        tokenTypeHint: token_type_hint,
        api_version: 3,
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof NcBaseErrorv2 && OAUTH_ERROR_CODE_MAP[error.error]) {
        return res.status(200).json({
          error: OAUTH_ERROR_CODE_MAP[error.error],
          error_description: error.message,
        });
      }
      return res.status(200).json({
        error: 'invalid_request',
        error_description: 'Token revocation failed',
      });
    }
  }

  // ─── Client Management Endpoints (authenticated) ───────────────────

  @Get('/api/v3/oauth/clients')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthClientList', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async clientList(@TenantContext() context: NcContext, @Req() req: NcRequest) {
    const clients = await this.oauthClientService.listClients(context, req);
    return clients.map(({ client_secret: _, ...rest }) => rest);
  }

  @Get('/api/v3/oauth/clients/:clientId')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthClientGet', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async clientGet(
    @TenantContext() context: NcContext,
    @Param('clientId') clientId: string,
    @Req() req: NcRequest,
  ) {
    const { client_secret: _, ...client } =
      await this.oauthClientService.getClient(context, {
        clientId,
        req,
      });
    return client;
  }

  @Post('/api/v3/oauth/clients')
  @HttpCode(200)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthClientCreate', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async clientCreate(
    @TenantContext() context: NcContext,
    @Body() body,
    @Req() req: NcRequest,
  ) {
    return await this.oauthClientService.createClient(context, body, req);
  }

  @Patch('/api/v3/oauth/clients/:clientId')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthClientUpdate', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async clientUpdate(
    @TenantContext() context: NcContext,
    @Param('clientId') clientId: string,
    @Body() body,
    @Req() req: NcRequest,
  ) {
    return await this.oauthClientService.updateClient(context, {
      clientId,
      body,
      req,
    });
  }

  @Delete('/api/v3/oauth/clients/:clientId')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthClientDelete', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async clientDelete(
    @TenantContext() context: NcContext,
    @Param('clientId') clientId: string,
    @Req() req: NcRequest,
  ) {
    return await this.oauthClientService.deleteClient(context, {
      clientId,
      req,
    });
  }

  @Post('/api/v3/oauth/clients/:clientId/regenerate-secret')
  @HttpCode(200)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthClientRegenerateSecret', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async clientRegenerateSecret(
    @TenantContext() context: NcContext,
    @Param('clientId') clientId: string,
    @Req() req: NcRequest,
  ) {
    return await this.oauthClientService.regenerateClientSecret(context, {
      clientId,
      req,
    });
  }

  // ─── User Authorization Endpoints (authenticated) ──────────────────

  @Get('/api/v3/oauth/authorizations')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthAuthorizationList', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async authorizationList(@Req() req: NcRequest) {
    return await this.oauthTokenService.listUserAuthorizations(req.user.id);
  }

  @Delete('/api/v3/oauth/authorizations/:tokenId')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('v3OAuthAuthorizationRevoke', {
    scope: 'org',
    blockOAuthTokenAccess: true,
  })
  async authorizationRevoke(
    @Param('tokenId') tokenId: string,
    @Req() req: NcRequest,
  ) {
    return await this.oauthTokenService.revokeUserAuthorization(
      req.user.id,
      tokenId,
    );
  }
}
