import path from 'path';
import Url from 'url';
import { Readable } from 'stream';
import { AppEvents, PublicAttachmentScope } from 'nocodb-sdk';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import mime from 'mime/lite';
import slash from 'slash';
import PQueue from 'p-queue';
import axios from 'axios';
import hash from 'object-hash';
import moment from 'moment';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { mimeIcons } from '~/utils/mimeTypes';
import { FileReference, PresignedUrl } from '~/models';
import { utf8ify } from '~/helpers/stringHelpers';
import { NcError } from '~/helpers/catchError';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { RootScopes } from '~/utils/globals';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';
import Noco from '~/Noco';
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

const thumbnailMimes = ['image/'];

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
        try {
          const nanoId = nanoid(5);

          const filePath = this.sanitizeUrlPath([
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
            const sharp = Noco.sharp;

            if (sharp) {
              try {
                const metadata = await sharp(file.path, {
                  limitInputPixels: false,
                }).metadata();

                if (metadata.width && metadata.height) {
                  tempMetadata.width = metadata.width;
                  tempMetadata.height = metadata.height;
                }
              } catch (e) {
                this.logger.error(`${file.path} is not an image file`);
              }
            }
          }

          const url = await storageAdapter.fileCreate(
            slash(path.join(destPath, fileName)),
            file,
          );

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
          errors.push(e);
        }
      }),
    );

    await queue.onIdle();

    if (errors.length) {
      for (const error of errors) {
        this.logger.error(error);
      }
      throw errors[0];
    }

    const generateThumbnail = attachments.filter((attachment) =>
      thumbnailMimes.some((type) => attachment.mimetype.startsWith(type)),
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
            response = await axios.head(url, { maxRedirects: 5 });
            mimeType = response.headers['content-type']?.split(';')[0];
            size = response.headers['content-length'];
            finalUrl = response.request.res.responseUrl;
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
            mimeType = mime.getType(path.extname(fileNameWithExt).slice(1));
          }

          let attachmentUrl, file;

          if (!base64TempStream) {
            const { url: _attachmentUrl, data: _file } =
              await storageAdapter.fileCreateByUrl(
                slash(path.join(fileDestPath, fileName)),
                finalUrl,
                {
                  fetchOptions: {
                    // The sharp requires image to be passed as buffer.);
                    buffer: mimeType.includes('image'),
                  },
                },
              );

            attachmentUrl = _attachmentUrl;
            file = _file;
          } else {
            attachmentUrl = await storageAdapter.fileCreateByStream(
              slash(path.join(fileDestPath, fileName)),
              base64TempStream,
            );

            file = base64Buffer;
          }

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          if (mimeType.includes('image')) {
            const sharp = Noco.sharp;

            if (sharp) {
              try {
                const metadata = await sharp(file, {
                  limitInputPixels: true,
                }).metadata();

                if (metadata.width && metadata.height) {
                  tempMetadata.width = metadata.width;
                  tempMetadata.height = metadata.height;
                }
              } catch (e) {
                this.logger.error(`${file.path} is not an image file`);
              }
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
          errors.push(e);
        }
      }),
    );

    await queue.onIdle();

    if (errors.length) {
      errors.forEach((error) => this.logger.error(error));
      throw errors[0];
    }

    const generateThumbnail = attachments.filter((attachment) =>
      thumbnailMimes.some((type) => attachment.mimetype.startsWith(type)),
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

  async getAttachmentFromRecord(param: {
    record: any;
    column: { title: string };
    urlOrPath: string;
  }) {
    const { record, column, urlOrPath } = param;

    const attachment = record[column.title];

    if (!attachment || !attachment.length) {
      NcError.genericNotFound('Attachment', urlOrPath);
    }

    const fileObject = attachment.find(
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
