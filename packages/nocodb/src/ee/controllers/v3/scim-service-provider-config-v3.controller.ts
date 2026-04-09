import {
  Controller,
  Get,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScimServiceProviderConfigService } from '~/ee/services/scim/scim-service-provider-config.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { ScimExceptionFilter } from '~/ee/filters/scim-exception/scim-exception.filter';
import { ScimContentTypeInterceptor } from '~/ee/interceptors/scim-content-type/scim-content-type.interceptor';

@Controller()
@UseGuards(ScimAuthGuard)
@UseFilters(ScimExceptionFilter)
@UseInterceptors(ScimContentTypeInterceptor)
export class ScimServiceProviderConfigController {
  constructor(
    private readonly scimServiceProviderConfigService: ScimServiceProviderConfigService,
  ) {}

  @Get('/api/v3/meta/orgs/:orgId/scim/v2/ServiceProviderConfig')
  async getServiceProviderConfig() {
    // Discovery endpoints return static config — no plan check needed.
    return this.scimServiceProviderConfigService.getServiceProviderConfig();
  }
}
