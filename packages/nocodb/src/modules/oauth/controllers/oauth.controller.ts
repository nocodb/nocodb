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
    const {
      client_id,
      redirect_uri,
      state,
      approved,
      code_challenge,
      code_challenge_method,
      scope,
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
    const { grant_type, code, redirect_uri, code_verifier, refresh_token } =
      body;

    const { client_id: clientId, client_secret: clientSecret } = body;

    if (!grant_type) {
      return {
        error: 'invalid_request',
        error_description: 'Missing required parameter: grant_type',
      };
    }

    try {
      switch (grant_type) {
        case 'authorization_code':
          if (!code || !redirect_uri || !clientId) {
            return {
              error: 'invalid_request',
              error_description:
                'Missing required parameters: code, redirect_uri, client_id',
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
            clientId,
            redirectUri: redirect_uri,
            codeVerifier: code_verifier,
            clientSecret,
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
          });

        default:
          return {
            error: 'unsupported_grant_type',
            error_description: `Unsupported grant_type: ${grant_type}`,
          };
      }
    } catch (error) {
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
  async revoke(@Body() body) {
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
}
