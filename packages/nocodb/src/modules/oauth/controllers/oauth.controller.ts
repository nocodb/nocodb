import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthClient } from '~/models';
import { NcError } from '~/helpers/ncError';

@Controller()
export class OAuthController {
  constructor(private readonly oauthService: OauthClientService) {}

  @UseGuards(PublicApiLimiterGuard)
  @Get(['/api/v2/public/oauth/client/:clientId'])
  async getOAuthClient(@Param('clientId') clientId: string) {
    const client = await OAuthClient.getByClientId(clientId);

    if (!client) {
      NcError.notFound('Oauth Client');
    }

    return client;
  }
}
