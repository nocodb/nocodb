import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  ScriptV3GetResponseType,
  ScriptV3ListResponseType,
} from '~/services/v3/scripts-v3.types';
import { ScriptV3RequestType } from '~/services/v3/scripts-v3.types';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ScriptsV3Service } from '~/services/v3/scripts-v3.service';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ScriptsV3Controller {
  constructor(private readonly scriptsV3Service: ScriptsV3Service) {}

  @Get(`${PREFIX_APIV3_METABASE}/scripts`)
  @Acl('listScripts', { scope: 'base' })
  async scriptList(
    @TenantContext() context: NcContext,
  ): Promise<ScriptV3ListResponseType> {
    return await this.scriptsV3Service.scriptList(context);
  }

  @Get(`${PREFIX_APIV3_METABASE}/scripts/:id`)
  @Acl('getScript', { scope: 'base' })
  async scriptGet(
    @TenantContext() context: NcContext,
    @Param('id') id: string,
  ): Promise<ScriptV3GetResponseType> {
    return await this.scriptsV3Service.scriptGet(context, id);
  }

  @Post(`${PREFIX_APIV3_METABASE}/scripts`)
  @Acl('createScript', { scope: 'base' })
  async scriptCreate(
    @TenantContext() context: NcContext,
    @Body() body: ScriptV3RequestType,
    @Request() req: NcRequest,
  ): Promise<ScriptV3GetResponseType> {
    return await this.scriptsV3Service.scriptCreate(context, body, req);
  }

  @Patch(`${PREFIX_APIV3_METABASE}/scripts/:id`)
  @Acl('updateScript', { scope: 'base' })
  async scriptUpdate(
    @TenantContext() context: NcContext,
    @Param('id') id: string,
    @Body() body: ScriptV3RequestType,
    @Request() req: NcRequest,
  ): Promise<ScriptV3GetResponseType> {
    return await this.scriptsV3Service.scriptUpdate(context, id, body, req);
  }

  @Delete(`${PREFIX_APIV3_METABASE}/scripts/:id`)
  @Acl('deleteScript', { scope: 'base' })
  async scriptDelete(
    @TenantContext() context: NcContext,
    @Param('id') id: string,
    @Request() req: NcRequest,
  ): Promise<boolean> {
    return await this.scriptsV3Service.scriptDelete(context, id, req);
  }
}
