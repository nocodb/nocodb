import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ScimSchemasService } from '~/ee/services/scim/scim-schemas.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';

@Controller()
@UseGuards(ScimAuthGuard)
export class ScimSchemasController {
  constructor(private readonly scimSchemasService: ScimSchemasService) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/Schemas')
  async getSchemas(@Param('workspaceId') workspaceId: string) {
    return this.scimSchemasService.getSchemas();
  }
}
