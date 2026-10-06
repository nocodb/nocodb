import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { NcApiVersion } from 'nocodb-sdk';
import type {
  DataDeleteRequest,
  DataInsertRequest,
  DataRecord,
  DataUpdateRequest,
} from '~/services/v3/data-v3.types';
import { DataUpsertRequest } from '~/services/v3/data-v3.types';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { normalizeArrayQueryParam, parseHrtimeToMilliSeconds } from '~/helpers';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import { DataAttachmentV3Service } from '~/services/v3/data-attachment-v3.service';
import { PREFIX_APIV3_DATA } from '~/constants/controllers';

type V3RefRowIds =
  | string
  | string[]
  | number
  | number[]
  | Record<string, any>
  | Record<string, any>[];

/** `{}` is what body-parser leaves behind when a request carries no body. */
function isEmptyPayload(body: unknown): boolean {
  if (body === undefined || body === null) return true;
  if (Array.isArray(body)) return body.length === 0;
  return typeof body === 'object' && Object.keys(body).length === 0;
}

/**
 * Unlink ids may arrive in the body, in `?records=` (the body-less form left
 * behind when an intermediary drops a DELETE body, per RFC 9110 — same param
 * name as DELETE .../records), or both. The body is handed through untouched
 * when the query param is absent.
 */
function mergeUnlinkIdsFromQuery(
  refRowIds: V3RefRowIds,
  records: string | string[],
): V3RefRowIds {
  const queryIds = normalizeArrayQueryParam(records);
  if (!queryIds) return refRowIds;

  // The service reads the shape off the first entry, so both sources have to
  // arrive in the same `{ id }` form.
  const fromBody = (
    isEmptyPayload(refRowIds)
      ? []
      : Array.isArray(refRowIds)
      ? refRowIds
      : [refRowIds]
  ).map((id) => (id && typeof id === 'object' ? id : { id }));

  return [...fromBody, ...queryIds.map((id) => ({ id }))];
}

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class Datav3Controller {
  constructor(
    protected readonly dataV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
    protected readonly dataAttachmentV3Service: DataAttachmentV3Service,
  ) {}

  @Get(`${PREFIX_APIV3_DATA}/:modelId/records`)
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    context.cache = true;
    const startTime = process.hrtime();
    const responseData = await this.dataV3Service.dataList(context, {
      query: req.query,
      modelId: modelId,
      viewId: viewId,
      req,
    });
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(responseData);
  }

  @Post(`${PREFIX_APIV3_DATA}/:modelId/records/upsert`)
  @HttpCode(200)
  @Acl('dataUpsert')
  async dataUpsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Body() body: DataUpsertRequest,
  ) {
    context.cache = true;
    return await this.dataV3Service.dataUpsert(context, {
      modelId: modelId,
      body: body,
      cookie: req,
    });
  }

  @Post(`${PREFIX_APIV3_DATA}/:modelId/records`)
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Body() body: DataInsertRequest | DataInsertRequest[],
  ) {
    context.cache = true;
    return await this.dataV3Service.dataInsert(context, {
      modelId: modelId,
      body: body,
      viewId,
      cookie: req,
    });
  }

  @Post(
    `${PREFIX_APIV3_DATA}/:modelId/records/:recordId/fields/:columnId/upload`,
  )
  @HttpCode(200)
  @Acl('dataUpdate')
  async dataAttachmentUpload(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Param('recordId') recordId: string,
    @Param('columnId') columnId: string,
    @Body() body: { contentType: string; file: string; filename: string },
  ) {
    context.cache = true;
    return await this.dataAttachmentV3Service.appendBase64AttachmentToCellData({
      context,
      modelId,
      recordId,
      columnId,
      scope: undefined,
      attachment: body,
      req,
    });
  }

  @Delete(`${PREFIX_APIV3_DATA}/:modelId/records`)
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Body() body: DataDeleteRequest | DataDeleteRequest[],
    @Query('records') records: string | string[],
  ) {
    context.cache = true;
    return await this.dataV3Service.dataDelete(context, {
      modelId: modelId,
      cookie: req,
      viewId,
      // `{}` is what a body-less DELETE leaves behind, and the service's
      // per-record `id` check runs before it merges in `?records=`.
      body:
        normalizeArrayQueryParam(records) && isEmptyPayload(body) ? [] : body,
      queryRecords: records,
    });
  }

  @Patch(`${PREFIX_APIV3_DATA}/:modelId/records`)
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Body() body: DataUpdateRequest | DataUpdateRequest[],
  ) {
    context.cache = true;
    return await this.dataV3Service.dataUpdate(context, {
      modelId: modelId,
      body: body,
      cookie: req,
      viewId,
    });
  }

  @Get(`${PREFIX_APIV3_DATA}/:modelId/links/:columnId/:rowId`)
  @Acl('nestedDataList')
  async nestedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
  ) {
    context.cache = true;
    return await this.dataV3Service.nestedDataList(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      req,
    });
  }

  @Post(`${PREFIX_APIV3_DATA}/:modelId/links/:columnId/:rowId`)
  @HttpCode(200)
  @Acl('nestedDataLink')
  async nestedLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds:
      | string
      | string[]
      | number
      | number[]
      | Record<string, any>
      | Record<string, any>[],
  ) {
    context.cache = true;
    return await this.dataV3Service.nestedLink(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds,
      cookie: req,
    });
  }

  @Delete(`${PREFIX_APIV3_DATA}/:modelId/links/:columnId/:rowId`)
  @Acl('nestedDataUnlink')
  async nestedUnlink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds: V3RefRowIds,
    @Query('records') records: string | string[],
  ) {
    context.cache = true;
    return await this.dataV3Service.nestedUnlink(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds: mergeUnlinkIdsFromQuery(refRowIds, records),
      cookie: req,
    });
  }

  @Get(`${PREFIX_APIV3_DATA}/:modelId/count`)
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    context.cache = true;
    const countResult = await this.dataTableService.dataCount(context, {
      query: req.query,
      modelId,
      viewId,
      apiVersion: NcApiVersion.V3,
    });

    res.json(countResult);
  }
  @Get(`${PREFIX_APIV3_DATA}/:modelId/records/:rowId`)
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('rowId') rowId: string,
  ): Promise<DataRecord> {
    context.cache = true;
    return await this.dataV3Service.dataRead(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      req,
    });
  }
}
