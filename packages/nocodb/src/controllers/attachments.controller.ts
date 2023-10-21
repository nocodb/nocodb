import path from 'path';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  Response,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
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
  async upload(
    @UploadedFiles() files: Array<any>,
    @Body() body: any,
    @Request() req: any,
  ) {
    const attachments = await this.attachmentsService.upload({
      files: files,
      path: req.query?.path as string,
    });

    return attachments;
  }

  @Post(['/api/v1/db/storage/upload-by-url', '/api/v2/storage/upload-by-url'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async uploadViaURL(@Body() body: any, @Query('path') path: string) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
    });

    return attachments;
  }

  // @Get(/^\/download\/(.+)$/)
  // , getCacheMiddleware(), catchError(fileRead));
  @Get('/download/:filename(*)')
  // This route will match any URL that starts with
  async fileRead(@Param('filename') filename: string, @Response() res) {
    try {
      const { img, type } = await this.attachmentsService.fileRead({
        path: path.join('nc', 'uploads', filename),
      });

      res.writeHead(200, { 'Content-Type': type });
      res.end(img, 'binary');
    } catch (e) {
      console.log(e);
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
    @Response() res,
  ) {
    try {
      const { img, type } = await this.attachmentsService.fileRead({
        path: path.join(
          'nc',
          param1,
          param2,
          'uploads',
          ...filename.split('/'),
        ),
      });

      res.writeHead(200, { 'Content-Type': type });
      res.end(img, 'binary');
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Response() res) {
    try {
      const fpath = await PresignedUrl.getPath(`dltemp/${param}`);

      const { img } = await this.attachmentsService.fileRead({
        path: path.join('nc', 'uploads', fpath),
      });

      res.sendFile(img);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }
}
