import path from 'path';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AttachmentsService } from '~/services/attachments.service';
import { PresignedUrl } from '~/models';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/storage/upload', '/api/v2/storage/upload'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor, AnyFilesInterceptor())
  async upload(@UploadedFiles() files: Array<FileType>, @Req() req: Request) {
    const attachments = await this.attachmentsService.upload({
      files: files,
      path: req.query?.path?.toString(),
      req,
    });

    return attachments;
  }

  @Post(['/api/v1/db/storage/upload-by-url', '/api/v2/storage/upload-by-url'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async uploadViaURL(
    @Body() body: Array<AttachmentReqType>,
    @Query('path') path: string,
    @Req() req: Request,
  ) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
      req,
    });

    return attachments;
  }

  // @Get(/^\/download\/(.+)$/)
  // , getCacheMiddleware(), catchError(fileRead));
  @Get('/download/:filename(*)')
  // This route will match any URL that starts with
  async fileRead(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const file = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', filename),
      });

      res.sendFile(file.path);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  // @Get(/^\/dl\/([^/]+)\/([^/]+)\/(.+)$/)
  @Get('/dl/:param1([a-zA-Z0-9_-]+)/:param2([a-zA-Z0-9_-]+)/:filename(*)')
  // getCacheMiddleware(),
  async fileReadv2(
    @Param('param1') param1: string,
    @Param('param2') param2: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      const file = await this.attachmentsService.getFile({
        path: path.join(
          'nc',
          param1,
          param2,
          'uploads',
          ...filename.split('/'),
        ),
      });

      res.sendFile(file.path);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      const fpath = await PresignedUrl.getPath(`dltemp/${param}`);

      const file = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', fpath),
      });

      res.sendFile(file.path);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }
}
