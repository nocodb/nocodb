import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { PublicDatasService } from '~/services/public-datas.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { Column } from '~/models';
import { AttachmentsService } from '~/services/attachments.service';
import { NcError } from '~/helpers/catchError';

@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDatasController {
  constructor(
    protected readonly publicDatasService: PublicDatasService,
    protected readonly attachmentsService: AttachmentsService,
  ) {}

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
    '/api/v2/public/shared-view/:sharedViewUuid/rows',
  ])
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const pagedResponse = await this.publicDatasService.dataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
    });
    return pagedResponse;
  }

  @Get(['/api/v2/public/shared-view/:sharedViewUuid/count'])
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const pagedResponse = await this.publicDatasService.dataCount(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
    });
    return pagedResponse;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/aggregate',
    '/api/v2/public/shared-view/:sharedViewUuid/aggregate',
  ])
  async dataAggregate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const response = await this.publicDatasService.dataAggregate(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
    });

    return response;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/groupby',
    '/api/v2/public/shared-view/:sharedViewUuid/groupby',
  ])
  async dataGroupBy(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    return await this.publicDatasService.dataGroupBy(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
    });
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/group/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/group/:columnId',
  ])
  async groupedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('columnId') columnId: string,
  ) {
    const groupedData = await this.publicDatasService.groupedDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      groupColumnId: columnId,
    });
    return groupedData;
  }

  @Post([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
    '/api/v2/public/shared-view/:sharedViewUuid/rows',
  ])
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const insertResult = await this.publicDatasService.dataInsert(context, {
      sharedViewUuid: sharedViewUuid,
      password: req.headers?.['xc-password'] as string,
      body: req.body?.data,
      siteUrl: (req as any).ncSiteUrl,
      files: req.files as any[],
      req,
    });

    return insertResult;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/nested/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/nested/:columnId',
  ])
  async relDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('columnId') columnId: string,
  ) {
    let rowData: any;

    if (req.query.rowData) {
      try {
        rowData = JSON.parse(req.query.rowData as string);
      } catch {
        rowData = {};
      }
    }

    const pagedResponse = await this.publicDatasService.relDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      columnId: columnId,
      rowData,
    });

    return pagedResponse;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
  ])
  async publicMmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('rowId') rowId: string,
    @Param('columnId') columnId: string,
  ) {
    const paginatedResponse = await this.publicDatasService.publicMmList(
      context,
      {
        query: req.query,
        password: req.headers?.['xc-password'] as string,
        sharedViewUuid: sharedViewUuid,
        columnId: columnId,
        rowId: rowId,
      },
    );
    return paginatedResponse;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
  ])
  async publicHmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('rowId') rowId: string,
    @Param('columnId') columnId: string,
  ) {
    const paginatedResponse = await this.publicDatasService.publicHmList(
      context,
      {
        query: req.query,
        password: req.headers?.['xc-password'] as string,
        sharedViewUuid: sharedViewUuid,
        columnId: columnId,
        rowId: rowId,
      },
    );
    return paginatedResponse;
  }

  @Get(
    '/api/v2/public/shared-view/:sharedViewUuid/downloadAttachment/:columnId/:rowId',
  )
  async downloadPublicAttachment(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Query('urlOrPath') urlOrPath: string,
  ) {
    const column = await Column.get(context, {
      colId: columnId,
    });

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    const record = await this.publicDatasService.dataRead(context, {
      sharedViewUuid,
      query: {
        fields: column.title,
      },
      rowId,
      password: req.headers?.['xc-password'] as string,
    });

    if (!record) {
      NcError.recordNotFound(rowId);
    }

    return this.attachmentsService.getAttachmentFromRecord({
      record,
      column,
      urlOrPath,
    });
  }

  @Post(['/api/v2/public/shared-view/:sharedViewUuid/bulk/dataList'])
  async bulkDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const response = await this.publicDatasService.bulkDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
      body: req.body,
    });

    return response;
  }

  @Post(['/api/v2/public/shared-view/:sharedViewUuid/bulk/group'])
  async bulkGroupBy(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const response = await this.publicDatasService.bulkGroupBy(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
      body: req.body,
    });

    return response;
  }
}
