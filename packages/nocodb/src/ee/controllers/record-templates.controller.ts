import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { RecordTemplatesService } from '~/services/record-templates/record-templates.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import type { NcContext, NcRequest } from '~/interface/config';
import type { CreateRecordTemplateDto } from '~/services/record-templates/dto/create-record-template.dto';
import type { UpdateRecordTemplateDto } from '~/services/record-templates/dto/update-record-template.dto';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class RecordTemplatesController {
  constructor(
    private readonly recordTemplatesService: RecordTemplatesService,
  ) {}

  /**
   * List ALL templates in a base (across all tables).
   * Used by the "Manage Templates" modal which shows a base-level view.
   * The v2 path uses `/all` suffix to avoid conflict with the `:templateId` param route.
   */
  @Get([
    '/api/v1/db/meta/bases/:baseId/record-templates',
    '/api/v2/meta/bases/:baseId/record-templates/all',
  ])
  @Acl('recordTemplateList')
  async listAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
  ) {
    return new PagedResponseImpl(
      await this.recordTemplatesService.list({
        context,
        baseId,
        req,
      }),
    );
  }

  /** List templates scoped to a specific table (source_id) */
  @Get([
    '/api/v1/db/meta/bases/:baseId/tables/:sourceId/record-templates',
    '/api/v2/meta/bases/:baseId/tables/:sourceId/record-templates',
  ])
  @Acl('recordTemplateList')
  async list(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return new PagedResponseImpl(
      await this.recordTemplatesService.listBySource({
        context,
        baseId,
        sourceId,
        req,
      }),
    );
  }

  @Get([
    '/api/v1/db/meta/bases/:baseId/record-templates/:templateId',
    '/api/v2/meta/bases/:baseId/record-templates/:templateId',
  ])
  @Acl('recordTemplateGet')
  async get(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('templateId') templateId: string,
  ) {
    return await this.recordTemplatesService.get({
      context,
      templateId,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/bases/:baseId/tables/:sourceId/record-templates',
    '/api/v2/meta/bases/:baseId/tables/:sourceId/record-templates',
  ])
  @HttpCode(200)
  @Acl('recordTemplateCreate')
  async create(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: CreateRecordTemplateDto,
  ) {
    return await this.recordTemplatesService.create({
      context,
      baseId,
      sourceId,
      body,
      userId: req['user'].id,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/bases/:baseId/record-templates/:templateId',
    '/api/v2/meta/bases/:baseId/record-templates/:templateId',
  ])
  @Acl('recordTemplateUpdate')
  async update(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('templateId') templateId: string,
    @Body() body: UpdateRecordTemplateDto,
  ) {
    return await this.recordTemplatesService.update({
      context,
      templateId,
      body,
      userId: req['user'].id,
      req,
    });
  }

  @Delete([
    '/api/v1/db/meta/bases/:baseId/record-templates/:templateId',
    '/api/v2/meta/bases/:baseId/record-templates/:templateId',
  ])
  @Acl('recordTemplateDelete')
  async delete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('templateId') templateId: string,
  ) {
    return await this.recordTemplatesService.delete({
      context,
      templateId,
      userId: req['user'].id,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/bases/:baseId/record-templates/:templateId/use',
    '/api/v2/meta/bases/:baseId/record-templates/:templateId/use',
  ])
  @HttpCode(200)
  @Acl('recordTemplateUse')
  async use(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('templateId') templateId: string,
  ) {
    return await this.recordTemplatesService.use({
      context,
      templateId,
      userId: req['user'].id,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/bases/:baseId/tables/:sourceId/record-templates/:templateId/create-from',
    '/api/v2/meta/bases/:baseId/tables/:sourceId/record-templates/:templateId/create-from',
  ])
  @HttpCode(200)
  @Acl('recordTemplateUse')
  async createFrom(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Param('templateId') templateId: string,
  ) {
    return await this.recordTemplatesService.createFromTemplate({
      context,
      templateId,
      baseId,
      sourceId,
      userId: req['user'].id,
      req,
    });
  }
}
