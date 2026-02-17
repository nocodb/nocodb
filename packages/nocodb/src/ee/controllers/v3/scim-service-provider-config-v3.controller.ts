import { Controller, Get, Param, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { ScimServiceProviderConfigService } from '~/ee/services/scim/scim-service-provider-config.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { ScimExceptionFilter } from '~/ee/filters/scim-exception/scim-exception.filter';
import { ScimContentTypeInterceptor } from '~/ee/interceptors/scim-content-type/scim-content-type.interceptor';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { checkForFeature } from '~/ee/helpers/paymentHelpers';
import { isCloud } from '~/utils';

@Controller()
@UseGuards(ScimAuthGuard)
@UseFilters(ScimExceptionFilter)
@UseInterceptors(ScimContentTypeInterceptor)
export class ScimServiceProviderConfigController {
  constructor(
    private readonly scimServiceProviderConfigService: ScimServiceProviderConfigService,
  ) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/ServiceProviderConfig')
  async getServiceProviderConfig(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
  ) {
    if (isCloud) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_SCIM);
    }
    return this.scimServiceProviderConfigService.getServiceProviderConfig();
  }
}
