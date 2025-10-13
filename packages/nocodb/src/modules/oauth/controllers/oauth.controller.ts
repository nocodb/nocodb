import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NcRequest } from 'nocodb-sdk';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthClient } from '~/models';
import { NcError } from '~/helpers/ncError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Controller()
export class OAuthController {
  constructor(
    protected readonly oauthService: OauthClientService,
    protected readonly oauthAuthorizationService: OauthAuthorizationService,
    protected readonly oauthTokenService: OauthTokenService,
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

  @Post('/api/v2/oauth/authorize')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async authorize(@Body() body, @Req() req: NcRequest) {
    const { client_id, redirect_uri, state, approved } = body;

    // Validate required parameters
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
          codeChallenge: body.code_challenge,
          codeChallengeMethod: body.code_challenge_method,
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
  async token(@Body() body) {
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      code_verifier,
      refresh_token,
    } = body;

    // Validate required parameters based on grant type
    if (!grant_type) {
      NcError.badRequest('Missing required parameter: grant_type');
    }

    try {
      switch (grant_type) {
        case 'authorization_code':
          // Validate required parameters for authorization code flow
          if (!code || !redirect_uri || !client_id) {
            NcError.badRequest(
              'Missing required parameters: code, redirect_uri, client_id',
            );
          }

          return await this.oauthTokenService.exchangeCodeForTokens({
            code,
            clientId: client_id,
            redirectUri: redirect_uri,
            codeVerifier: code_verifier, // PKCE code verifier
          });

        case 'refresh_token':
          // Validate required parameters for refresh token flow
          if (!refresh_token || !client_id) {
            NcError.badRequest(
              'Missing required parameters: refresh_token, client_id',
            );
          }

          return await this.oauthTokenService.refreshAccessToken({
            refreshToken: refresh_token,
            clientId: client_id,
          });

        default:
          NcError.badRequest(`Unsupported grant_type: ${grant_type}`);
      }
    } catch (error) {
      // Return OAuth 2.0 compliant error response
      if (error.message) {
        return {
          error: 'invalid_request',
          error_description: error.message,
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
  async revoke(@Body() body) {
    const { token, client_id, token_type_hint } = body;

    // Validate required parameters
    if (!token || !client_id) {
      NcError.badRequest('Missing required parameters: token, client_id');
    }

    try {
      await this.oauthTokenService.revokeToken({
        token,
        clientId: client_id,
        tokenTypeHint: token_type_hint,
      });

      // OAuth 2.0 spec requires 200 OK response for successful revocation
      return { success: true };
    } catch (error) {
      // Return OAuth 2.0 compliant error response
      if (error.message) {
        return {
          error: 'invalid_request',
          error_description: error.message,
        };
      }
      return {
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      };
    }
  }
}
