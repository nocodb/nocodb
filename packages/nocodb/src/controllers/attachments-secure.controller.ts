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
import { Response } from 'express';
import { PublicAttachmentScope } from 'nocodb-sdk';
import contentDisposition from 'content-disposition';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AttachmentsService } from '~/services/attachments.service';
import { PresignedUrl } from '~/models';
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import {
  ATTACHMENT_ROOTS,
  isPreviewAllowed,
  localFileExists,
} from '~/helpers/attachmentHelpers';
import { NC_DATA_IMPORT_FILE_SIZE } from '~/constants';

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
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    const attachments = await this.attachmentsService.upload({
      files: files,
      req,
      scope,
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
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      req,
      scope,
    });

    return attachments;
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/data-import/upload'])
  @HttpCode(200)
  @UseInterceptors(
    UploadAllowedInterceptor,
    AnyFilesInterceptor({
      limits: {
        fileSize: NC_DATA_IMPORT_FILE_SIZE,
      },
    }),
  )
  async dataImportUpload(
    @UploadedFiles() files: Array<FileType>,
    @Req() req: NcRequest & { user: { id: string } },
  ) {
    return await this.attachmentsService.upload({
      files,
      req,
    });
  }

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      const fullPath = await PresignedUrl.getPath(`dltemp/${param}`);

      const queryHelper = fullPath.split('?');

      const fpath = queryHelper[0];

      // Key names must match what PresignedUrl.getSignedUrl serialises.
      let queryResponseContentType = null;
      let queryResponseContentDisposition = null;
      let queryResponseContentEncoding = null;

      if (queryHelper.length > 1) {
        const query = new URLSearchParams(queryHelper[1]);
        queryResponseContentType = query.get('ResponseContentType');
        queryResponseContentDisposition = query.get(
          'ResponseContentDisposition',
        );
        queryResponseContentEncoding = query.get('ResponseContentEncoding');
      }

      const targetParam = param.split('/')[2];

      const filePath = ATTACHMENT_ROOTS.includes(targetParam) ? '' : 'uploads';

      const file = await this.attachmentsService.getFile({
        path: path.join('nc', filePath, fpath),
      });

      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      // For non-previewable types force a download regardless of the
      // cached response headers.
      const previewable = isPreviewAllowed({
        mimetype: file.type,
        path: file.path,
      });

      if (!previewable) {
        res.setHeader(
          'Content-Disposition',
          contentDisposition(path.basename(file.path), { type: 'attachment' }),
        );
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(file.path);
      }

      if (queryResponseContentType) {
        res.setHeader('Content-Type', queryResponseContentType);

        if (queryResponseContentEncoding) {
          res.setHeader(
            'Content-Type',
            `${queryResponseContentType}; charset=${queryResponseContentEncoding}`,
          );
        }
      }

      if (queryResponseContentDisposition) {
        res.setHeader('Content-Disposition', queryResponseContentDisposition);
      }

      if (queryResponseContentEncoding) {
        res.setHeader('Content-Encoding', queryResponseContentEncoding);
      }

      res.sendFile(file.path);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  @UseGuards(DataApiLimiterGuard, GlobalGuard)
  @Get('/api/v2/downloadAttachment/:modelId/:columnId/:rowId')
  @Acl('dataRead')
  async downloadAttachment(
    @TenantContext() context: NcContext,
    @Param('modelId') modelId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Query('urlOrPath') urlOrPath: string,
  ) {
    return this.attachmentsService.downloadAttachment(context, {
      modelId,
      columnId,
      rowId,
      urlOrPath,
    });
  }
}
