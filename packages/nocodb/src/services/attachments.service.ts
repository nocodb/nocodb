import path from 'path';
import Url from 'url';
import { Readable } from 'stream';
import { AppEvents, OperationSource, PublicAttachmentScope } from 'nocodb-sdk';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import mime from 'mime/lite';
import slash from 'slash';
import PQueue from 'p-queue';
import axios from 'axios';
import hash from 'object-hash';
import moment from 'moment';
import { imageSize } from 'image-size';
import { imageSizeFromFile } from 'image-size/fromFile';
import type { AttachmentReqType, FileType, NcContext } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { getFilteredAgents } from '~/utils/ssrf';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { DataTableService } from '~/services/data-table.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { mimeIcons } from '~/utils/mimeTypes';
import { Column, FileReference, PresignedUrl } from '~/models';
import { utf8ify } from '~/helpers/stringHelpers';
import { NcBaseError, NcError } from '~/helpers/catchError';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { RootScopes } from '~/utils/globals';
import {
  getSafeAttachmentErrorLog,
  tryDeleteUploadedFile,
  validateAndNormaliseLocalPath,
} from '~/helpers/attachmentHelpers';
import { supportsThumbnails } from '~/utils/attachmentUtils';
import { NC_ATTACHMENT_FIELD_SIZE } from '~/constants';
import { UseWorker } from '~/decorators/use-worker.decorator';

interface AttachmentObject {
  url?: string;
  path?: string;
  title: string;
  mimetype: string;
  size: number;
  icon?: string;
  signedPath?: string;
  signedUrl?: string;
}

// ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html - extended with some more characters
const normalizeFilename = (filename: string) => {
  return filename.replace(/[\\/:*?"<>'`#|%~{}[\]^]/g, '_');
};

@Injectable()
export class AttachmentsService {
  protected logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly appHooksService: AppHooksService,
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
    @Inject(forwardRef(() => DataTableService))
    private readonly dataTableService: DataTableService,
  ) {}

  async upload(param: {
    files: FileType[];
    req: NcRequest;
    path?: string;
    scope?: PublicAttachmentScope;
  }) {
    // Validate scope if exist
    if (
      param.scope &&
      !Object.values(PublicAttachmentScope).includes(param.scope)
    ) {
      NcError.invalidAttachmentUploadScope();
    }

    const userId = param.req?.user?.id || 'anonymous';

    param.path = param.scope
      ? `${hash(userId)}`
      : param.path || `${moment().format('YYYY/MM/DD')}/${hash(userId)}`;

    // TODO: add getAjvValidatorMw
    const _filePath = this.sanitizeUrlPath(
      param.path?.toString()?.split('/') || [''],
    );
    const _destPath = path.join(
      'nc',
      param.scope ? param.scope : 'uploads',
      ..._filePath,
    );

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    // just in case we want to increase concurrency in future
    const queue = new PQueue({ concurrency: 1 });

    const attachments = [];
    const errors = [];

    if (!param.files?.length) {
      NcError.badRequest('No attachment provided!');
    }

    queue.addAll(
      param.files?.map((file) => async () => {
        let uploadedKey: string;
        try {
          const nanoId = nanoid(5);

          // For scoped uploads the scope itself must appear in the stored
          // `attachment.path` (otherwise the signed-URL controller falls
          // back to `nc/uploads/...` because `param.split('/')[2]` won't be a
          // known scope, and the file won't be found).
          const filePath = this.sanitizeUrlPath([
            ...(param.scope ? [param.scope] : []),
            ...(param?.path?.toString()?.split('/') || ['']),
            ...(param.scope ? [nanoId] : []),
          ]);

          const destPath = param.scope
            ? path.join(_destPath, `${nanoId}`)
            : _destPath;

          const originalName = utf8ify(file.originalname);
          const fileName = param.scope
            ? `${normalizeFilename(
                path.parse(originalName).name,
              )}${path.extname(originalName)}`
            : `${normalizeFilename(path.parse(originalName).name)}_${nanoid(
                5,
              )}${path.extname(originalName)}`;

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          if (file.mimetype.includes('image')) {
            // Pure-JS header parse — reads only the bytes needed for dimensions.
            // Replaces sharp().metadata(), which decoded the full image via native
            // libvips SIMD on the web tier and could crash the process with SIGILL
            // (uncatchable by this try/catch). Also removes the limitInputPixels:false
            // full-decode DoS vector. Thumbnail generation still runs sharp, but only
            // on the worker tier via a job.
            try {
              const { width, height } = await imageSizeFromFile(file.path);

              if (width && height) {
                tempMetadata.width = width;
                tempMetadata.height = height;
              }
            } catch (e) {
              this.logger.error(`${file.path} is not an image file`);
            }
          }

          uploadedKey = slash(path.join(destPath, fileName));
          const url = await storageAdapter.fileCreate(uploadedKey, file);

          await FileReference.insert(
            {
              workspace_id: RootScopes.ROOT,
              base_id: RootScopes.ROOT,
            },
            {
              storage: storageAdapter.name,
              file_url:
                url ?? path.join('download', filePath.join('/'), fileName),
              file_size: file.size,
              fk_user_id: userId,
              deleted: true, // root file references are always deleted as they are not associated with any record
            },
          );

          const attachment: AttachmentObject = {
            ...(url
              ? { url }
              : {
                  path: path.join('download', filePath.join('/'), fileName),
                }),
            title: originalName,
            mimetype: file.mimetype,
            size: file.size,
            icon: mimeIcons[path.extname(originalName).slice(1)] || undefined,
            ...tempMetadata,
          };

          await PresignedUrl.signAttachment({ attachment });

          attachments.push(attachment);
        } catch (e) {
          if (uploadedKey) {
            await tryDeleteUploadedFile(storageAdapter, uploadedKey);
          }
          errors.push(e);
        }
      }),
    );

    await queue.onIdle();

    if (errors.length) {
      errors.forEach((error) => {
        const { message, stack } = getSafeAttachmentErrorLog(error);
        this.logger.error(`Attachment upload failed: ${message}`, stack);
      });

      const firstError = errors[0];

      if (firstError instanceof NcError || firstError instanceof NcBaseError) {
        throw firstError;
      }

      NcError.internalServerError('Failed to upload attachment');
    }

    const generateThumbnail = attachments.filter((attachment) =>
      supportsThumbnails(attachment),
    );

    if (generateThumbnail.length) {
      await this.jobsService.add(JobTypes.ThumbnailGenerator, {
        context: {
          base_id: RootScopes.ROOT,
          workspace_id: RootScopes.ROOT,
        },
        attachments: generateThumbnail,
        scope: param.scope,
      });
    }

    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'file',
      req: param.req,
    });

    return attachments;
  }

  @UseWorker()
  async uploadViaURL(param: {
    urls: AttachmentReqType[];
    req: NcRequest;
    path?: string;
    scope?: PublicAttachmentScope;
    /**
     * Skip the HEAD pre-check (content-type/length + redirect resolution). Use for
     * pre-signed URLs that authorize GET only — e.g. E2B sandbox downloads, where a
     * HEAD returns 401. Mimetype is then inferred from the file extension and the
     * size cap is still enforced by the storage adapter's streamed GET
     * (axios `maxContentLength`). Pass `size`/`mimetype` on each url when known.
     */
    skipHead?: boolean;
  }) {
    // Validate scope if exist
    if (
      param.scope &&
      !Object.values(PublicAttachmentScope).includes(param.scope)
    ) {
      NcError.invalidAttachmentUploadScope();
    }

    const userId = param.req?.user?.id || 'anonymous';

    param.path = param.scope
      ? `${hash(userId)}`
      : param.path || `${moment().format('YYYY/MM/DD')}/${hash(userId)}`;

    const filePath = this.sanitizeUrlPath(
      param?.path?.toString()?.split('/') || [''],
    );

    const destPath = path.join(
      'nc',
      param.scope ? param.scope : 'uploads',
      ...filePath,
    );

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    // just in case we want to increase concurrency in future
    const queue = new PQueue({ concurrency: 1 });

    const attachments = [];
    const errors = [];

    if (!param.urls?.length) {
      NcError.badRequest('No attachment provided!');
    }

    queue.addAll(
      param.urls?.map?.((urlMeta) => async () => {
        let uploadedKey: string;
        try {
          const { url, fileName: _fileName } = urlMeta;

          const nanoId = nanoid(5);

          const filePath = this.sanitizeUrlPath([
            ...(param.scope ? [param.scope] : []),
            ...(param?.path?.toString()?.split('/') || ['']),
            ...(param.scope ? [nanoId] : []),
          ]);

          const fileDestPath = param.scope
            ? path.join(destPath, `${nanoId}`)
            : destPath;

          let mimeType,
            response,
            size,
            finalUrl = url;

          let base64TempStream: Readable;
          let base64Buffer: Buffer;

          if (!url.startsWith('data:')) {
            if (!param.skipHead) {
              response = await axios.head(url, {
                maxRedirects: 5,
                ...getFilteredAgents({
                  url,
                  source: OperationSource.ATTACHMENTS,
                }),
              });
              mimeType = response.headers['content-type']?.split(';')[0];
              size = response.headers['content-length'];

              if (size && +size > NC_ATTACHMENT_FIELD_SIZE) {
                NcError.get().invalidRequestBody(
                  `File is too large. Maximum allowed size is ${(
                    NC_ATTACHMENT_FIELD_SIZE /
                    (1024 * 1024)
                  ).toFixed(2)} MB`,
                );
              }

              finalUrl = response.request.res.responseUrl;
            } else {
              // No HEAD probe — take the caller-supplied size (if any);
              size = urlMeta.size ? String(urlMeta.size) : undefined;
            }
          } else {
            if (!url.startsWith('data')) {
              NcError.badRequest('Invalid data URL format');
            }

            const [metadata, base64Data] = url.split(',');

            const metadataHelper = metadata.split(':');

            if (metadataHelper.length < 2) {
              NcError.badRequest('Invalid data URL format');
            }

            const mimetypeHelper = metadataHelper[1].split(';');

            mimeType = mimetypeHelper[0];
            size = Buffer.byteLength(base64Data, 'base64');

            if (size > NC_ATTACHMENT_FIELD_SIZE) {
              NcError.get().invalidRequestBody(
                `File is too large. Maximum allowed size is ${(
                  NC_ATTACHMENT_FIELD_SIZE /
                  (1024 * 1024)
                ).toFixed(2)} MB`,
              );
            }

            base64Buffer = Buffer.from(base64Data, 'base64');
            base64TempStream = Readable.from(base64Buffer);
          }

          const parsedUrl = Url.parse(finalUrl, true);
          const decodedPath = decodeURIComponent(parsedUrl.pathname);
          const fileNameWithExt = _fileName || path.basename(decodedPath);

          const fileName = param.scope
            ? `${normalizeFilename(
                path.parse(fileNameWithExt).name,
              )}${path.extname(fileNameWithExt)}`
            : `${normalizeFilename(path.parse(fileNameWithExt).name)}_${nanoid(
                5,
              )}${path.extname(fileNameWithExt)}`;

          if (!mimeType) {
            mimeType =
              mime.getType(path.extname(fileNameWithExt).slice(1)) ||
              'application/octet-stream';
          }

          let attachmentUrl, file;
          uploadedKey = slash(path.join(fileDestPath, fileName));

          if (!base64TempStream) {
            const { url: _attachmentUrl, data: _file } =
              await storageAdapter.fileCreateByUrl(uploadedKey, finalUrl, {
                fetchOptions: {
                  // The sharp requires image to be passed as buffer.);
                  buffer: mimeType.includes('image'),
                },
              });

            attachmentUrl = _attachmentUrl;
            file = _file;
          } else {
            attachmentUrl = await storageAdapter.fileCreateByStream(
              uploadedKey,
              base64TempStream,
            );

            file = base64Buffer;
          }

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          if (mimeType.includes('image')) {
            // Pure-JS header parse (no native libvips on the web tier) — see the
            // multipart path above. `file` is already a Buffer here.
            try {
              const { width, height } = imageSize(file);

              if (width && height) {
                tempMetadata.width = width;
                tempMetadata.height = height;
              }
            } catch (e) {
              this.logger.error(`${file.path} is not an image file`);
            }
          }

          await FileReference.insert(
            {
              workspace_id: RootScopes.ROOT,
              base_id: RootScopes.ROOT,
            },
            {
              storage: storageAdapter.name,
              file_url:
                attachmentUrl ??
                path.join('download', filePath.join('/'), fileName),
              file_size: size ? parseInt(size) : urlMeta.size,
              fk_user_id: userId,
              deleted: true, // root file references are always deleted as they are not associated with any record
            },
          );

          const attachment: AttachmentObject = {
            ...(attachmentUrl
              ? { url: attachmentUrl }
              : {
                  path: path.join('download', filePath.join('/'), fileName),
                }),
            title: fileNameWithExt,
            mimetype: mimeType || urlMeta.mimetype,
            size: size ? parseInt(size) : urlMeta.size,
            icon:
              mimeIcons[path.extname(fileNameWithExt).slice(1)] || undefined,
            ...tempMetadata,
          };

          await PresignedUrl.signAttachment({ attachment });

          attachments.push(attachment);
        } catch (e) {
          if (uploadedKey) {
            await tryDeleteUploadedFile(storageAdapter, uploadedKey);
          }
          errors.push(e);
        }
      }),
    );

    await queue.onIdle();

    if (errors.length) {
      errors.forEach((error) => {
        const { message, stack } = getSafeAttachmentErrorLog(error);
        this.logger.error(`Attachment upload failed: ${message}`, stack);
      });

      const firstError = errors[0];

      if (firstError instanceof NcError || firstError instanceof NcBaseError) {
        throw firstError;
      }

      NcError.internalServerError('Failed to upload attachment');
    }

    const generateThumbnail = attachments.filter((attachment) =>
      supportsThumbnails(attachment),
    );

    if (generateThumbnail.length) {
      await this.jobsService.add(JobTypes.ThumbnailGenerator, {
        context: {
          base_id: RootScopes.ROOT,
          workspace_id: RootScopes.ROOT,
        },
        attachments: generateThumbnail,
        scope: param.scope,
      });
    }

    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'url',
      req: param.req,
    });

    return attachments;
  }

  async getFile(param: { path: string }): Promise<{
    path: string;
    type: string;
  }> {
    const type =
      mime.getType(path.extname(param.path).split('/').pop().slice(1)) ||
      'text/plain';

    const filePath = validateAndNormaliseLocalPath(param.path, true);
    return { path: filePath, type };
  }

  async downloadAttachment(
    context: NcContext,
    param: {
      modelId: string;
      columnId: string;
      rowId: string;
      urlOrPath: string;
    },
  ) {
    const column = await Column.get(context, {
      colId: param.columnId,
    });

    if (!column) {
      NcError.fieldNotFound(param.columnId);
    }

    const record = await this.dataTableService.dataRead(context, {
      baseId: context.base_id,
      modelId: param.modelId,
      rowId: param.rowId,
      query: {
        fields: column.title,
      },
    });

    if (!record) {
      NcError.recordNotFound(param.rowId);
    }

    return this.getAttachmentFromRecord({
      record,
      column,
      urlOrPath: param.urlOrPath,
    });
  }

  async getAttachmentFromRecord(param: {
    record: any;
    column: { title: string };
    urlOrPath: string;
  }) {
    const { record, column, urlOrPath } = param;

    const attachment = record[column.title];

    if (!attachment) {
      NcError.genericNotFound('Attachment', urlOrPath);
    }

    // The value can be a plain attachment array (direct Attachment column) or a
    // nested structure when the column is a Lookup/Rollup over an attachment
    // field — e.g. `[[{...}], [{...}]]` for HM/MM links, or deeper for nested
    // lookups. Flatten recursively and collect the attachment objects so the
    // file can be located regardless of nesting. (See lookup attachment
    // download — the value reaching here is the parent row's lookup column.)
    const attachmentObjects: any[] = [];
    const collectAttachments = (val: any) => {
      if (Array.isArray(val)) {
        for (const item of val) collectAttachments(item);
      } else if (val && typeof val === 'object') {
        attachmentObjects.push(val);
      }
    };
    collectAttachments(attachment);

    const fileObject = attachmentObjects.find(
      (a) => a.url === urlOrPath || a.path === urlOrPath,
    );

    if (!fileObject) {
      NcError.genericNotFound('Attachment', urlOrPath);
    }

    await PresignedUrl.signAttachment({
      attachment: fileObject,
      preview: false,
      filename: fileObject.title,
      expireSeconds: 5 * 60,
    });

    return {
      ...(fileObject?.path
        ? { path: fileObject.signedPath }
        : {
            url: fileObject.signedUrl,
          }),
    };
  }

  sanitizeUrlPath(paths) {
    return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
  }
}
