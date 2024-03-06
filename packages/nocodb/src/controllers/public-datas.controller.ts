import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { PublicDatasService } from '~/services/public-datas.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';

@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicDatasController {
  constructor(private readonly publicDatasService: PublicDatasService) {}

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
    '/api/v2/public/shared-view/:sharedViewUuid/rows',
  ])
  async dataList(
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const pagedResponse = await this.publicDatasService.dataList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
    });
    return pagedResponse;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/groupby',
    '/api/v2/public/shared-view/:sharedViewUuid/groupby',
  ])
  async dataGroupBy(
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    return await this.publicDatasService.dataGroupBy({
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
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('columnId') columnId: string,
  ) {
    const groupedData = await this.publicDatasService.groupedDataList({
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
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const insertResult = await this.publicDatasService.dataInsert({
      sharedViewUuid: sharedViewUuid,
      password: req.headers?.['xc-password'] as string,
      body: req.body?.data,
      siteUrl: (req as any).ncSiteUrl,
      files: req.files as any[],
    });

    return insertResult;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/nested/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/nested/:columnId',
  ])
  async relDataList(
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('columnId') columnId: string,
  ) {
    const pagedResponse = await this.publicDatasService.relDataList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      columnId: columnId,
    });

    return pagedResponse;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
  ])
  async publicMmList(
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('rowId') rowId: string,
    @Param('columnId') columnId: string,
  ) {
    const paginatedResponse = await this.publicDatasService.publicMmList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      columnId: columnId,
      rowId: rowId,
    });
    return paginatedResponse;
  }

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
  ])
  async publicHmList(
    @Req() req: Request,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('rowId') rowId: string,
    @Param('columnId') columnId: string,
  ) {
    const paginatedResponse = await this.publicDatasService.publicHmList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      columnId: columnId,
      rowId: rowId,
    });
    return paginatedResponse;
  }
}
