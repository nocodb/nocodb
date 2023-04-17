import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { NC_ATTACHMENT_FIELD_SIZE } from '../constants';
import { PublicDatasService } from '../services/public-datas.service';

@Controller()
export class PublicDatasController {
  constructor(private readonly publicDatasService: PublicDatasService) {}

  @Get('/api/v1/db/public/shared-view/:sharedViewUuid/rows')
  async dataList(
    @Request() req,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const pagedResponse = await this.publicDatasService.dataList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
    });
    return pagedResponse;
  }

  // todo: Handle the error case where view doesnt belong to model
  @Get('/api/v1/db/public/shared-view/:sharedViewUuid/group/:columnId')
  async groupedDataList(
    @Request() req,
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

  // todo: multer
  //   router.post(
  //   '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
  //   multer({
  //            storage: multer.diskStorage({}),
  // limits: {
  //   fieldSize: NC_ATTACHMENT_FIELD_SIZE,
  // },
  // }).any(),
  //   catchError(dataInsert)
  // );
  @Post('/api/v1/db/public/shared-view/:sharedViewUuid/rows')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  async dataInsert(
    @Request() req,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const insertResult = await this.publicDatasService.dataInsert({
      sharedViewUuid: sharedViewUuid,
      password: req.headers?.['xc-password'] as string,
      body: req.body?.data,
      siteUrl: (req as any).ncSiteUrl,
      files: req.files,
    });

    return insertResult;
  }

  @Get('/api/v1/db/public/shared-view/:sharedViewUuid/nested/:columnId')
  async relDataList(
    @Request() req,
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

  @Get('/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:colId')
  async publicMmList(
    @Request() req,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('rowId') rowId: string,
    @Param('colId') colId: string,
  ) {
    const paginatedResponse = await this.publicDatasService.publicMmList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      columnId: colId,
      rowId: rowId,
    });
    return paginatedResponse;
  }

  @Get('/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:colId')
  async publicHmList(
    @Request() req,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Param('rowId') rowId: string,
    @Param('colId') colId: string,
  ) {
    const paginatedResponse = await this.publicDatasService.publicHmList({
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
      columnId: colId,
      rowId: rowId,
    });
    return paginatedResponse;
  }
}
