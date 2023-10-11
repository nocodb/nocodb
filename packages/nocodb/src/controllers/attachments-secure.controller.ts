import path from 'path';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  Response,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import hash from 'object-hash';
import moment from 'moment';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AttachmentsService } from '~/services/attachments.service';
import { PresignedUrl } from '~/models';
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
export class AttachmentsSecureController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/storage/upload', '/api/v2/storage/upload'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor, AnyFilesInterceptor())
  async upload(@UploadedFiles() files: Array<any>, @Request() req) {
    const path = `${moment().format('YYYY/MM/DD')}/${hash(req.user.id)}`;

    const attachments = await this.attachmentsService.upload({
      files: files,
      path: path,
    });

    return attachments;
  }

  @Post(['/api/v1/db/storage/upload-by-url', '/api/v2/storage/upload-by-url'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async uploadViaURL(@Body() body: any, @Request() req) {
    const path = `${moment().format('YYYY/MM/DD')}/${hash(req.user.id)}`;

    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
    });

    return attachments;
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
