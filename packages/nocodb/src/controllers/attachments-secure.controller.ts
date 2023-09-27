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
import { TemporaryUrl } from '~/models';

@Controller()
export class AttachmentsSecureController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @UseGuards(GlobalGuard)
  @Post('/api/v1/db/storage/upload')
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

  @Post('/api/v1/db/storage/upload-by-url')
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor)
  @UseGuards(GlobalGuard)
  async uploadViaURL(@Body() body: any, @Query('path') path: string) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
    });

    return attachments;
  }

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Response() res) {
    try {
      const fpath = await TemporaryUrl.getPath(`dltemp/${param}`);

      const { img } = await this.attachmentsService.fileRead({
        path: path.join('nc', 'uploads', fpath),
      });

      res.sendFile(img);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }
}
