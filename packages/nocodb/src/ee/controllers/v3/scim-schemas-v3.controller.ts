import {
  Controller,
  Get,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScimSchemasService } from '~/ee/services/scim/scim-schemas.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { ScimExceptionFilter } from '~/ee/filters/scim-exception/scim-exception.filter';
import { ScimContentTypeInterceptor } from '~/ee/interceptors/scim-content-type/scim-content-type.interceptor';

@Controller()
@UseGuards(ScimAuthGuard)
@UseFilters(ScimExceptionFilter)
@UseInterceptors(ScimContentTypeInterceptor)
export class ScimSchemasController {
  constructor(private readonly scimSchemasService: ScimSchemasService) {}

  @Get('/api/v3/meta/orgs/:orgId/scim/v2/Schemas')
  async getSchemas() {
    // Discovery endpoints return static schema definitions — no plan check needed.
    // Authentication via ScimAuthGuard ensures only valid SCIM clients can access.
    return this.scimSchemasService.getSchemas();
  }
}
