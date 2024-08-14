import path from 'path';
import Url from 'url';
import { AppEvents } from 'nocodb-sdk';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import slash from 'slash';
import PQueue from 'p-queue';
import axios from 'axios';
import hash from 'object-hash';
import moment from 'moment';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type Sharp from 'sharp';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import mimetypes, { mimeIcons } from '~/utils/mimeTypes';
import { FileReference, PresignedUrl } from '~/models';
import { utf8ify } from '~/helpers/stringHelpers';
import { NcError } from '~/helpers/catchError';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { RootScopes } from '~/utils/globals';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';

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

  async upload(param: { files: FileType[]; req?: NcRequest; path?: string }) {
    const userId = param.req?.user.id || 'anonymous';

    param.path =
      param.path || `${moment().format('YYYY/MM/DD')}/${hash(userId)}`;

    // TODO: add getAjvValidatorMw
    const filePath = this.sanitizeUrlPath(
      param.path?.toString()?.split('/') || [''],
    );
    const destPath = path.join('nc', 'uploads', ...filePath);

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
          const originalName = utf8ify(file.originalname);
          const fileName = `${normalizeFilename(
            path.parse(originalName).name,
          )}_${nanoid(5)}${path.extname(originalName)}`;

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          if (file.mimetype.includes('image')) {
            let sharp: typeof Sharp;

            try {
              sharp = (await import('sharp')).default;
            } catch (e) {
              this.logger.warn(
                `Thumbnail generation is not supported in this platform at the moment. Error: ${e.message}`,
              );
            }

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
      });
    }

    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'file',
      req: param.req,
    });

    return attachments;
  }

  async uploadViaURL(param: {
    urls: AttachmentReqType[];
    req?: NcRequest;
    path?: string;
  }) {
    const userId = param.req?.user.id || 'anonymous';

    param.path =
      param.path || `${moment().format('YYYY/MM/DD')}/${hash(userId)}`;

    const filePath = this.sanitizeUrlPath(
      param?.path?.toString()?.split('/') || [''],
    );
    const destPath = path.join('nc', 'uploads', ...filePath);

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

          let mimeType,
            response,
            size,
            finalUrl = url;

          if (!url.startsWith('data:')) {
            response = await axios.head(url, { maxRedirects: 5 });
            mimeType = response.headers['content-type']?.split(';')[0];
            size = response.headers['content-length'];
            finalUrl = response.request.res.responseUrl;
          }

          const parsedUrl = Url.parse(finalUrl, true);
          const decodedPath = decodeURIComponent(parsedUrl.pathname);
          const fileNameWithExt = _fileName || path.basename(decodedPath);

          const fileName = `${normalizeFilename(
            path.parse(fileNameWithExt).name,
          )}_${nanoid(5)}${path.extname(fileNameWithExt)}`;

          if (!mimeType) {
            mimeType = mimetypes[path.extname(fileNameWithExt).slice(1)];
          }

          const { url: attachmentUrl, data: file } =
            await storageAdapter.fileCreateByUrl(
              slash(path.join(destPath, fileName)),
              finalUrl,
              {
                fetchOptions: {
                  // The sharp requires image to be passed as buffer.);
                  buffer: mimeType.includes('image'),
                },
              },
            );

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          if (mimeType.includes('image')) {
            let sharp: typeof Sharp;
            try {
              sharp = (await import('sharp')).default;
            } catch {
              // ignore
            }

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
            } else {
              this.logger.warn(
                `Thumbnail generation is not supported in this platform at the moment.`,
              );
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
      mimetypes[path.extname(param.path).split('/').pop().slice(1)] ||
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
