import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { getBaseSchema } from 'src/ee/helpers/scriptHelper';
import type { ScriptType } from 'nocodb-sdk';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ScriptsService } from '~/services/scripts.service';
import { NcContext, NcRequest } from '~/interface/config';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Acl('listScripts')
  @Get('/api/v2/meta/bases/:baseId/scripts')
  async listScripts(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    return await this.scriptsService.listScripts(context, baseId);
  }

  @Acl('listScripts')
  @Get('/api/v2/meta/bases/:baseId/scripts/:scriptId')
  async getScript(
    @TenantContext() context: NcContext,
    @Param('scriptId') scriptId: string,
  ) {
    return await this.scriptsService.getScript(context, scriptId);
  }

  @Acl('editOrCreateScript')
  @Post('/api/v2/meta/bases/:baseId/scripts')
  async createScript(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() scriptBody: Partial<ScriptType>,
    @Req() req: NcRequest,
  ) {
    return await this.scriptsService.createScript(
      context,
      baseId,
      scriptBody,
      req,
    );
  }

  @Acl('editOrCreateScript')
  @Patch('/api/v2/meta/bases/:baseId/scripts/:scriptId')
  async updateScript(
    @TenantContext() context: NcContext,
    @Param('scriptId') scriptId: string,
    @Body()
    body: Pick<
      ScriptType,
      'title' | 'description' | 'meta' | 'order' | 'code' | 'config'
    >,
  ) {
    return await this.scriptsService.updateScript(context, scriptId, body);
  }

  @Acl('editOrCreateScript')
  @Delete('/api/v2/meta/bases/:baseId/scripts/:scriptId')
  async deleteScript(
    @TenantContext() context: NcContext,
    @Param('scriptId') scriptId: string,
  ) {
    return await this.scriptsService.deleteScript(context, scriptId);
  }

  @Acl('baseSchema')
  @Get('/api/v2/meta/bases/:baseId/schema')
  async getBaseInfo(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    return await getBaseSchema(baseId);
  }
}
