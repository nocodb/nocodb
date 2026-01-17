import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScimServiceProviderConfigService } from '~/ee/services/scim/scim-service-provider-config.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';

@Controller()
@UseGuards(ScimAuthGuard)
export class ScimServiceProviderConfigController {
  constructor(
    private readonly scimServiceProviderConfigService: ScimServiceProviderConfigService,
  ) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/ServiceProviderConfig')
  async getServiceProviderConfig(@Param('workspaceId') workspaceId: string) {
    return this.scimServiceProviderConfigService.getServiceProviderConfig();
  }
}
