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
import multer from 'multer';
import {
  AnyFilesInterceptor,
} from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { NC_ATTACHMENT_FIELD_SIZE } from '../../constants';
import { GlobalGuard } from '../../guards/global/global.guard'
import { UploadAllowedInterceptor } from '../../interceptors/is-upload-allowed/is-upload-allowed.interceptor';
import { AttachmentsService } from './attachments.service';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @UseGuards(GlobalGuard)
  @Post(
    '/api/v1/db/storage/upload',
    //   multer({
    //            storage: multer.diskStorage({}),
    // limits: {
    //   fieldSize: NC_ATTACHMENT_FIELD_SIZE,
    // },
    // }).any(),
    //   [
    //     extractProjectIdAndAuthenticate,
    //     catchError(isUploadAllowedMw),
    //     catchError(upload),
    //   ]
    // );
  )
  @HttpCode(200)
  @UseInterceptors(
    UploadAllowedInterceptor,
    AnyFilesInterceptor({
      storage: multer.diskStorage({}),
      // limits: {
      //   fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      // },
      limits: {
        fileSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
  )
  async upload(
    @UploadedFiles() files: Array<any>,
    @Body() body: any,
    @Request() req: any,
    @Query('path') path: string,
  ) {
    const attachments = await this.attachmentsService.upload({
      files: files,
      path: req.query?.path as string,
    });

    return attachments;
  }

  @Post('/api/v1/db/storage/upload-by-url')
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor)
  //   [
  //     extractProjectIdAndAuthenticate,
  //   catchError(isUploadAllowedMw),
  //   catchError(uploadViaURL),
  // ]
  // );
  @UseGuards(GlobalGuard)
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
}
