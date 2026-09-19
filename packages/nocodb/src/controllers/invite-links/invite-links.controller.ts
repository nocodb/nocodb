import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InviteLinkScope } from 'nocodb-sdk';
import { InviteLinkReqType } from 'nocodb-sdk';
import { NcContext, NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { InviteLinksService } from '~/services/invite-links/invite-links.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';

/**
 * Managing links is base/workspace-scoped and ACL'd like any other admin
 * action. Redeeming lives on its own pair of routes:
 *
 *   GET  /api/v2/invite-links/:token   unauthenticated preview, grants nothing
 *   POST /api/v2/invite-links/:token   authenticated redeem
 *
 * The split is deliberate: a GET that granted access would fire on every link
 * preview, crawler, scanner and mail-client prefetch that ever saw the URL.
 */
@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class InviteLinksController {
  constructor(protected readonly inviteLinksService: InviteLinksService) {}

  @Get('/api/v2/meta/bases/:baseId/invite-links')
  @Acl('baseInviteLinkList')
  async listForBase(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
  ) {
    const links = await this.inviteLinksService.list(context, {
      scope: InviteLinkScope.BASE,
      baseId,
      req,
    });

    return { list: links };
  }

  @Post('/api/v2/meta/bases/:baseId/invite-links')
  @HttpCode(200)
  @Acl('baseInviteLinkCreate')
  async createForBase(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: InviteLinkReqType,
    @Req() req: NcRequest,
  ) {
    return this.inviteLinksService.create(context, {
      scope: InviteLinkScope.BASE,
      baseId,
      body,
      req,
    });
  }

  @Patch('/api/v2/meta/bases/:baseId/invite-links/:linkId')
  @Acl('baseInviteLinkUpdate')
  async updateForBase(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('linkId') linkId: string,
    @Body() body: Partial<InviteLinkReqType>,
    @Req() req: NcRequest,
  ) {
    return this.inviteLinksService.update(context, {
      scope: InviteLinkScope.BASE,
      baseId,
      linkId,
      body,
      req,
    });
  }

  @Delete('/api/v2/meta/bases/:baseId/invite-links/:linkId')
  @Acl('baseInviteLinkDelete')
  async revokeForBase(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('linkId') linkId: string,
    @Req() req: NcRequest,
  ) {
    return this.inviteLinksService.revoke(context, {
      scope: InviteLinkScope.BASE,
      baseId,
      linkId,
      req,
    });
  }

  @Post('/api/v2/invite-links/:token/accept')
  @HttpCode(200)
  @Acl('inviteLinkAccept', { scope: 'org' })
  async accept(
    @TenantContext() context: NcContext,
    @Param('token') token: string,
    @Req() req: NcRequest,
  ) {
    return this.inviteLinksService.accept(context, { token, req });
  }
}

/**
 * The preview is the only unauthenticated surface. It is rate-limited with the
 * public limiter and answers with the thing's name and the role on offer — it
 * never returns the token, the creator, or who else is a member.
 */
@Controller()
@UseGuards(PublicApiLimiterGuard)
export class PublicInviteLinksController {
  constructor(protected readonly inviteLinksService: InviteLinksService) {}

  @Get('/api/v2/invite-links/:token')
  async preview(
    @TenantContext() context: NcContext,
    @Param('token') token: string,
  ) {
    return this.inviteLinksService.preview(context, { token });
  }
}
