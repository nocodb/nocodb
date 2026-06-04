import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  OrgUserRoles,
  PlanFeatureTypes,
  type WhiteLabelConfig,
} from 'nocodb-sdk';
import { NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { License } from '~/decorators/license.decorator';
import { WhiteLabelService } from '~/services/white-label.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License(PlanFeatureTypes.FEATURE_WHITE_LABEL)
export class WhiteLabelController {
  constructor(protected readonly whiteLabelService: WhiteLabelService) {}

  @Get('/api/v2/meta/white-label')
  @Acl('whiteLabelGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async get(): Promise<WhiteLabelConfig> {
    return this.whiteLabelService.getConfig();
  }

  @Put('/api/v2/meta/white-label')
  @Acl('whiteLabelUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async update(
    @Body() body: Partial<WhiteLabelConfig>,
    @Req() req: NcRequest,
  ): Promise<WhiteLabelConfig> {
    return this.whiteLabelService.updateConfig(body, req);
  }
}
