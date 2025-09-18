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

@Controller()
export class OAuthController {
  constructor(
    protected readonly oauthService: OauthClientService,
    protected readonly oauthAuthorizationService: OauthAuthorizationService,
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
}
