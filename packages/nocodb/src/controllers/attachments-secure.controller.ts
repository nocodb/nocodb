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
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AttachmentsService } from '~/services/attachments.service';
import { Column, PresignedUrl } from '~/models';
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { DataTableService } from '~/services/data-table.service';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { ATTACHMENT_ROOTS, localFileExists } from '~/helpers/attachmentHelpers';

@Controller()
export class AttachmentsSecureController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly dataTableService: DataTableService,
  ) {}

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

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      const fullPath = await PresignedUrl.getPath(`dltemp/${param}`);

      const queryHelper = fullPath.split('?');

      const fpath = queryHelper[0];

      let queryResponseContentType = null;
      let queryResponseContentDisposition = null;

      if (queryHelper.length > 1) {
        const query = new URLSearchParams(queryHelper[1]);
        queryResponseContentType = query.get('response-content-type');
        queryResponseContentDisposition = query.get(
          'response-content-disposition',
        );
      }

      const targetParam = param.split('/')[2];

      const filePath = ATTACHMENT_ROOTS.includes(targetParam) ? '' : 'uploads';

      const file = await this.attachmentsService.getFile({
        path: path.join('nc', filePath, fpath),
      });

      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      if (queryResponseContentType) {
        res.setHeader('Content-Type', queryResponseContentType);
      }

      if (queryResponseContentDisposition) {
        res.setHeader('Content-Disposition', queryResponseContentDisposition);
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
    const column = await Column.get(context, {
      colId: columnId,
    });

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    const record = await this.dataTableService.dataRead(context, {
      baseId: context.base_id,
      modelId,
      rowId,
      query: {
        fields: column.title,
      },
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
}
