import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { NcRequest } from 'nocodb-sdk';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthClient } from '~/models';
import { NcError } from '~/helpers/ncError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthDcrService } from '~/modules/oauth/services/oauth-dcr.service';
import { OauthMetadataService } from '~/modules/oauth/services/oauth-metadata.service';

@Controller()
export class OAuthController {
  constructor(
    protected readonly oauthService: OauthClientService,
    protected readonly oauthAuthorizationService: OauthAuthorizationService,
    protected readonly oauthTokenService: OauthTokenService,
    protected readonly oauthDcrService: OauthDcrService,
    protected readonly oauthMetadataService: OauthMetadataService,
  ) {}

  @UseGuards(PublicApiLimiterGuard)
  @Get(['/api/v2/public/oauth/client/:clientId'])
  async getOAuthClient(@Param('clientId') clientId: string) {
    const client = await OAuthClient.getByClientId(clientId);

    if (!client) {
      NcError.notFound('Oauth Client');
    }

    return client;
  }

  @Get('/api/v2/oauth/authorize')
  @UseGuards(MetaApiLimiterGuard)
  async authorizeRedirect(@Req() req: NcRequest, @Res() res: Response) {
    const queryParams = new URLSearchParams(req.query).toString();
    const redirectUrl = `${req.ncSiteUrl}/#/oauth/authorize${
      queryParams ? '?' + queryParams : ''
    }`;

    return res.redirect(redirectUrl);
  }

  @Post('/api/v2/oauth/authorize')
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
      console.error(e);
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

  @UseGuards(PublicApiLimiterGuard)
  @Post(['/api/v2/oauth/token'])
  async token(@Body() body, @Headers('content-type') contentType: string) {
    if (
      !contentType ||
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return {
        error: 'invalid_request',
        error_description:
          'Content-Type must be application/x-www-form-urlencoded',
      };
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
      return {
        error: 'invalid_request',
        error_description: 'Missing required parameter: grant_type',
      };
    }

    try {
      switch (grant_type) {
        case 'authorization_code':
          if (!code || !redirect_uri) {
            return {
              error: 'invalid_request',
              error_description:
                'Missing required parameters: code, redirect_uri',
            };
          }

          if (!code_verifier) {
            return {
              error: 'invalid_request',
              error_description: 'Missing required parameter: code_verifier',
            };
          }

          return await this.oauthTokenService.exchangeCodeForTokens({
            code,
            redirectUri: redirect_uri,
            codeVerifier: code_verifier,
            clientSecret,
            resource,
          });

        case 'refresh_token':
          if (!refresh_token) {
            return {
              error: 'invalid_request',
              error_description: 'Missing required parameter: refresh_token',
            };
          }

          if (!clientId && !clientSecret) {
            return {
              error: 'invalid_request',
              error_description: 'Missing required parameter: client_id',
            };
          }

          return await this.oauthTokenService.refreshAccessToken({
            refreshToken: refresh_token,
            clientId,
            clientSecret,
            resource,
          });

        default:
          return {
            error: 'unsupported_grant_type',
            error_description: `Unsupported grant_type: ${grant_type}`,
          };
      }
    } catch (error) {
      console.log(error);
      if (error.message === 'invalid_client') {
        return {
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        };
      }
      if (error.message === 'invalid_grant') {
        return {
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        };
      }
      return {
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      };
    }
  }

  @UseGuards(PublicApiLimiterGuard)
  @Post(['/api/v2/oauth/revoke'])
  async revoke(@Body() body, @Headers('content-type') contentType: string) {
    if (
      !contentType ||
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return {
        error: 'invalid_request',
        error_description:
          'Content-Type must be application/x-www-form-urlencoded',
      };
    }

    const { token, token_type_hint } = body;

    const { client_id: clientId, client_secret: clientSecret } = body;

    if (!token || !clientId) {
      return {
        error: 'invalid_request',
        error_description: 'Missing required parameters: token, client_id',
      };
    }

    try {
      await this.oauthTokenService.revokeToken({
        token,
        clientId,
        clientSecret,
        tokenTypeHint: token_type_hint,
      });

      return { success: true };
    } catch (error) {
      if (error.message === 'invalid_client') {
        return {
          error: 'invalid_client',
          error_description: 'Client authentication failed',
        };
      }
      return {
        error: 'invalid_request',
        error_description: error.message || 'Token revocation failed',
      };
    }
  }

  // Dynamic Client Registration (DCR) Endpoints
  @UseGuards(PublicApiLimiterGuard)
  @Post(['/api/v2/oauth/register'])
  async registerClient(
    @Body() body,
    @Headers('content-type') contentType: string,
  ) {
    if (!contentType || !contentType.includes('application/json')) {
      return {
        error: 'invalid_request',
        error_description:
          'Content-Type must be application/json for client registration',
      };
    }

    try {
      return await this.oauthDcrService.registerClient(body);
    } catch (error) {
      if (error.message.startsWith('invalid_client_metadata:')) {
        return {
          error: 'invalid_client_metadata',
          error_description: error.message.replace(
            'invalid_client_metadata: ',
            '',
          ),
        };
      }
      if (error.message.startsWith('invalid_redirect_uri:')) {
        return {
          error: 'invalid_redirect_uri',
          error_description: error.message.replace(
            'invalid_redirect_uri: ',
            '',
          ),
        };
      }
      return {
        error: 'server_error',
        error_description:
          'An unexpected error occurred during client registration',
      };
    }
  }

  @Get(['/.well-known/oauth-authorization-server'])
  async getAuthorizationServerMetadata(
    @Req() req: NcRequest,
    @Res() res: Response,
  ) {
    const metadata =
      this.oauthMetadataService.getAuthorizationServerMetadata(req);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.json(metadata);
  }

  @Get(['/.well-known/oauth-protected-resource'])
  async getProtectedResourceMetadata(
    @Req() req: NcRequest,
    @Res() res: Response,
  ) {
    const metadata =
      this.oauthMetadataService.getProtectedResourceMetadata(req);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.json(metadata);
  }
}
