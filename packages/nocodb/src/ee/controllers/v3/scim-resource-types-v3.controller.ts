import {
  Controller,
  Get,
  Param,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { ScimResourceTypesService } from '~/ee/services/scim/scim-resource-types.service';
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
export class ScimResourceTypesController {
  constructor(
    private readonly scimResourceTypesService: ScimResourceTypesService,
  ) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/ResourceTypes')
  async getResourceTypes(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
  ) {
    if (isCloud) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_SCIM);
    }
    return this.scimResourceTypesService.getResourceTypes();
  }
}
