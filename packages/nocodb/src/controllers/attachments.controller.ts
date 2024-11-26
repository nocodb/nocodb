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
import contentDisposition from 'content-disposition';
import { PublicAttachmentScope } from 'nocodb-sdk';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AttachmentsService } from '~/services/attachments.service';
import { PresignedUrl } from '~/models';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcContext, NcRequest } from '~/interface/config';
import {
  ATTACHMENT_ROOTS,
  isPreviewAllowed,
  localFileExists,
} from '~/helpers/attachmentHelpers';
import { DataTableService } from '~/services/data-table.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';

@Controller()
export class AttachmentsController {
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
    @Req() req: NcRequest,
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    const attachments = await this.attachmentsService.upload({
      files: files,
      path: req.query?.path?.toString(),
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
    @Query('path') path: string,
    @Req() req: NcRequest,
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
      req,
      scope,
    });

    return attachments;
  }

  // @Get(/^\/download\/(.+)$/)
  // , getCacheMiddleware(), catchError(fileRead));
  @Get('/download/:filename(*)')
  // This route will match any URL that starts with
  async fileRead(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Query('filename') queryFilename?: string,
  ) {
    try {
      const file = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', filename),
      });

      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
        if (queryFilename) {
          res.setHeader(
            'Content-Disposition',
            contentDisposition(queryFilename, { type: 'attachment' }),
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

  // @Get(/^\/dl\/([^/]+)\/([^/]+)\/(.+)$/)
  @Get('/dl/:param1([a-zA-Z0-9_-]+)/:param2([a-zA-Z0-9_-]+)/:filename(*)')
  // getCacheMiddleware(),
  async fileReadv2(
    @Param('param1') param1: string,
    @Param('param2') param2: string,
    @Param('filename') filename: string,
    @Res() res: Response,
    @Query('filename') queryFilename?: string,
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

      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
        if (queryFilename) {
          res.setHeader(
            'Content-Disposition',
            contentDisposition(queryFilename, { type: 'attachment' }),
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

  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      const fullPath = await PresignedUrl.getPath(`dltemp/${param}`);

      const queryHelper = fullPath.split('?');

      const fpath = queryHelper[0];

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
