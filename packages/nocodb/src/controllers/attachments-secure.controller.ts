import path from 'path';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import hash from 'object-hash';
import moment from 'moment';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
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
  async upload(
    @UploadedFiles() files: Array<FileType>,
    @Req() req: NcRequest & { user: { id: string } },
  ) {
    const path = `${moment().format('YYYY/MM/DD')}/${hash(req.user.id)}`;

    const attachments = await this.attachmentsService.upload({
      files: files,
      path: path,
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
    @Req() req: NcRequest & { user: { id: string } },
  ) {
    const path = `${moment().format('YYYY/MM/DD')}/${hash(req.user.id)}`;

    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
      req,
    });

    return attachments;
  }

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      const fullPath = await PresignedUrl.getPath(`dltemp/${param}`);

      const queryHelper = fullPath.split('?');

      const fpath = queryHelper[0];

      let queryFilename = null;

      if (queryHelper.length > 1) {
        const query = new URLSearchParams(queryHelper[1]);
        queryFilename = query.get('filename');
      }

      const file = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', fpath),
      });

      if (this.attachmentsService.previewAvailable(file.type)) {
        if (queryFilename) {
          res.setHeader(
            'Content-Disposition',
            `attachment; filename=${queryFilename}`,
          );
        }
        res.sendFile(file.path);
      } else {
        res.download(file.path, queryFilename);
      }
    } catch (e) {
      res.status(404).send('Not found');
    }
  }
}
