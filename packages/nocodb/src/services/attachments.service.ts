import path from 'path';
import Url from 'url';
import { AppEvents } from 'nocodb-sdk';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import slash from 'slash';
import PQueue from 'p-queue';
import axios from 'axios';
import sharp from 'sharp';
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Local from '~/plugins/storage/Local';
import mimetypes, { mimeIcons } from '~/utils/mimeTypes';
import { PresignedUrl } from '~/models';
import { utf8ify } from '~/helpers/stringHelpers';
import { NcError } from '~/helpers/catchError';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { RootScopes } from '~/utils/globals';

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

@Injectable()
export class AttachmentsService {
  protected logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly appHooksService: AppHooksService,
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
  ) {}

  async upload(param: { path?: string; files: FileType[]; req: NcRequest }) {
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
          const fileName = `${path.parse(originalName).name}_${nanoid(
            5,
          )}${path.extname(originalName)}`;

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          if (file.mimetype.includes('image')) {
            try {
              const metadata = await sharp(file.path, {
                limitInputPixels: false,
              }).metadata();

              if (metadata.width && metadata.height) {
                tempMetadata.width = metadata.width;
                tempMetadata.height = metadata.height;
              }
            } catch (e) {
              // Might be invalid image - ignore
            }
          }

          const url = await storageAdapter.fileCreate(
            slash(path.join(destPath, fileName)),
            file,
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

          await this.signAttachment({ attachment });

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

    await this.jobsService.add(JobTypes.ThumbnailGenerator, {
      context: {
        base_id: RootScopes.ROOT,
        workspace_id: RootScopes.ROOT,
      },
      attachments,
    });

    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'file',
      req: param.req,
    });

    return attachments;
  }

  async uploadViaURL(param: {
    path?: string;
    urls: AttachmentReqType[];
    req: NcRequest;
  }) {
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
          const response = await axios.head(url, { maxRedirects: 5 });
          const finalUrl = response.request.res.responseUrl || url;

          const parsedUrl = Url.parse(finalUrl, true);
          const decodedPath = decodeURIComponent(parsedUrl.pathname);
          const fileNameWithExt = _fileName || path.basename(decodedPath);

          const fileName = `${path.parse(fileNameWithExt).name}_${nanoid(
            5,
          )}${path.extname(fileNameWithExt)}`;

          const { url: attachmentUrl, data: file } =
            await storageAdapter.fileCreateByUrl(
              slash(path.join(destPath, fileName)),
              finalUrl,
            );

          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          try {
            const metadata = await sharp(file, {
              limitInputPixels: true,
            }).metadata();

            if (metadata.width && metadata.height) {
              tempMetadata.width = metadata.width;
              tempMetadata.height = metadata.height;
            }
          } catch (e) {
            // Might be invalid image - ignore
          }

          let mimeType = response.headers['content-type']?.split(';')[0];
          const size = response.headers['content-length'];

          if (!mimeType) {
            mimeType = mimetypes[path.extname(fileNameWithExt).slice(1)];
          }

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

          await this.signAttachment({ attachment });

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

    await this.jobsService.add(JobTypes.ThumbnailGenerator, {
      context: {
        base_id: RootScopes.ROOT,
        workspace_id: RootScopes.ROOT,
      },
      attachments,
    });

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
    // get the local storage adapter to display local attachments
    const storageAdapter = new Local();
    const type =
      mimetypes[path.extname(param.path).split('/').pop().slice(1)] ||
      'text/plain';

    const filePath = storageAdapter.validateAndNormalisePath(
      slash(param.path),
      true,
    );
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

    await this.signAttachment({
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

  async signAttachment(param: {
    attachment: AttachmentObject;
    preview?: boolean;
    filename?: string;
    expireSeconds?: number;
  }) {
    const { attachment, preview = true, ...extra } = param;

    if (attachment?.path) {
      attachment.signedPath = await PresignedUrl.getSignedUrl({
        pathOrUrl: attachment.path.replace(/^download\//, ''),
        preview,
        mimetype: attachment.mimetype,
        ...(extra ? { ...extra } : {}),
      });
    } else if (attachment?.url) {
      attachment.signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl: attachment.url,
        preview,
        mimetype: attachment.mimetype,
        ...(extra ? { ...extra } : {}),
      });
    }
  }

  sanitizeUrlPath(paths) {
    return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
  }
}
