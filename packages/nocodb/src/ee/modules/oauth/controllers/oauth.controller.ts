import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { NcRequest } from 'nocodb-sdk';
import { OAuthController as OAuthControllerCE } from 'src/modules/oauth/controllers/oauth.controller';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthDcrService } from '~/modules/oauth/services/oauth-dcr.service';
import { OauthMetadataService } from '~/modules/oauth/services/oauth-metadata.service';

@Controller()
export class OAuthController extends OAuthControllerCE {
  constructor(
    protected readonly oauthAuthorizationService: OauthAuthorizationService,
    protected readonly oauthTokenService: OauthTokenService,
    protected readonly oauthDcrService: OauthDcrService,
    protected readonly oauthMetadataService: OauthMetadataService,
  ) {
    super(oauthAuthorizationService, oauthTokenService);
  }
  // Dynamic Client Registration (DCR) Endpoints
  @UseGuards(PublicApiLimiterGuard)
  @Post(['/api/v2/oauth/register'])
  async registerClient(
    @Req() req: NcRequest,
    @Body() body,
    @Headers('content-type') contentType: string,
    @Res() res: Response,
  ) {
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description:
          'Content-Type must be application/json for client registration',
      });
    }

    try {
      const client = await this.oauthDcrService.registerClient(body, req);
      return res.status(201).json(client);
    } catch (error) {
      if (error.message.startsWith('invalid_client_metadata:')) {
        return res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: error.message.replace(
            'invalid_client_metadata: ',
            '',
          ),
        });
      }
      if (error.message.startsWith('invalid_redirect_uri:')) {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: error.message.replace(
            'invalid_redirect_uri: ',
            '',
          ),
        });
      }
      return res.status(500).json({
        error: 'server_error',
        error_description:
          'An unexpected error occurred during client registration',
      });
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
