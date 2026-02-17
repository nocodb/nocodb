import {
  Controller,
  Get,
  Param,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScimResourceTypesService } from '~/ee/services/scim/scim-resource-types.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { ScimExceptionFilter } from '~/ee/filters/scim-exception/scim-exception.filter';
import { ScimContentTypeInterceptor } from '~/ee/interceptors/scim-content-type/scim-content-type.interceptor';

@Controller()
@UseGuards(ScimAuthGuard)
@UseFilters(ScimExceptionFilter)
@UseInterceptors(ScimContentTypeInterceptor)
export class ScimResourceTypesController {
  constructor(
    private readonly scimResourceTypesService: ScimResourceTypesService,
  ) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/ResourceTypes')
  async getResourceTypes(@Param('workspaceId') workspaceId: string) {
    return this.scimResourceTypesService.getResourceTypes();
  }
}
