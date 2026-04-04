import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { GcpMarketplaceService } from '~/services/gcp-marketplace.service';
import { NcError } from '~/helpers/ncError';

@Controller()
export class GcpMarketplaceController {
  private logger = new Logger(GcpMarketplaceController.name);

  constructor(private readonly gcpMarketplaceService: GcpMarketplaceService) {}

  /**
   * GCP Marketplace sign-up endpoint.
   * Google POSTs here with `x-gcp-marketplace-token` when a customer subscribes.
   * Verifies the JWT, creates a pending account, and redirects to NocoDB login.
   */
  @Post('/api/v1/gcp-marketplace/signup')
  async handleSignup(
    @Body('x-gcp-marketplace-token') token: string,
    @Req() req: NcRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      NcError._.badRequest('Missing marketplace token');
    }

    try {
      const { procurementAccountId, googleUserIdentity } =
        await this.gcpMarketplaceService.handleSignup(token);

      // Redirect to NocoDB login page with the procurement account ID
      // so the frontend can link the account after authentication.
      // Pass login_hint so Google SSO pre-selects the correct account.
      const params = new URLSearchParams({
        gcp_account: procurementAccountId,
      });

      if (googleUserIdentity) {
        params.set('login_hint', googleUserIdentity);
      }

      const redirectUrl = `${req.ncSiteUrl}/#/signin?${params.toString()}`;

      res.redirect(302, redirectUrl);
    } catch (e) {
      this.logger.error(`GCP Marketplace signup failed: ${e.message}`, e.stack);
      NcError._.badRequest('Invalid or expired marketplace token');
    }
  }

  /**
   * Link a pending GCP Marketplace account to the logged-in NocoDB user.
   * Called from the frontend after the user authenticates.
   */
  @UseGuards(GlobalGuard)
  @Post('/api/v1/gcp-marketplace/link-account')
  @HttpCode(200)
  async linkAccount(
    @Body() body: { procurement_account_id: string },
    @Req() req: NcRequest,
  ): Promise<{ success: boolean }> {
    const { procurement_account_id } = body;

    if (!procurement_account_id) {
      NcError._.badRequest('procurement_account_id is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      NcError._.unauthorized('Authentication required');
    }

    try {
      await this.gcpMarketplaceService.linkAccount(
        procurement_account_id,
        userId,
      );

      return { success: true };
    } catch (e) {
      this.logger.error(`GCP account linking failed: ${e.message}`, e.stack);
      NcError._.badRequest('Failed to link GCP Marketplace account');
    }
  }
}
