import path from 'path';
import { AppEvents } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import slash from 'slash';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Local from '~/plugins/storage/Local';
import mimetypes, { mimeIcons } from '~/utils/mimeTypes';
import { PresignedUrl } from '~/models';

@Injectable()
export class AttachmentsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async upload(param: {
    path?: string;
    // todo: proper type
    files: unknown[];
  }) {
    // TODO: add getAjvValidatorMw
    const filePath = this.sanitizeUrlPath(
      param.path?.toString()?.split('/') || [''],
    );
    const destPath = path.join('nc', 'uploads', ...filePath);

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const attachments = await Promise.all(
      param.files?.map(async (file: any) => {
        const fileName = `${nanoid(18)}${path.extname(file.originalname)}`;

        const url = await storageAdapter.fileCreate(
          slash(path.join(destPath, fileName)),
          file,
        );

        const attachment: {
          url?: string;
          path?: string;
          title: string;
          mimetype: string;
          size: number;
          icon?: string;
          signedPath?: string;
          signedUrl?: string;
        } = {
          ...(url ? { url } : {}),
          title: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          icon:
            mimeIcons[path.extname(file.originalname).slice(1)] || undefined,
        };

        const promises = [];
        // if `url` is null, then it is local attachment
        if (!url) {
          // then store the attachment path only
          // url will be constructed in `useAttachmentCell`
          attachment.path = `download/${filePath.join('/')}/${fileName}`;

          promises.push(
            PresignedUrl.getSignedUrl({
              path: attachment.path.replace(/^download\//, ''),
            }).then((r) => (attachment.signedPath = r)),
          );
        } else {
          if (attachment.url.includes('.amazonaws.com/')) {
            const relativePath = decodeURI(
              attachment.url.split('.amazonaws.com/')[1],
            );
            promises.push(
              PresignedUrl.getSignedUrl({
                path: relativePath,
                s3: true,
              }).then((r) => (attachment.signedUrl = r)),
            );
          }
        }

        return Promise.all(promises).then(() => attachment);
      }),
    );

    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'file',
    });

    return attachments;
  }

  async uploadViaURL(param: {
    path?: string;
    urls: {
      url: string;
      fileName: string;
      mimetype?: string;
      size?: string | number;
    }[];
  }) {
    // TODO: add getAjvValidatorMw
    const filePath = this.sanitizeUrlPath(
      param?.path?.toString()?.split('/') || [''],
    );
    const destPath = path.join('nc', 'uploads', ...filePath);

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const attachments = await Promise.all(
      param.urls?.map?.(async (urlMeta) => {
        const { url, fileName: _fileName } = urlMeta;

        const fileName = `${nanoid(18)}${_fileName || url.split('/').pop()}`;

        const attachmentUrl = await (storageAdapter as any).fileCreateByUrl(
          slash(path.join(destPath, fileName)),
          url,
        );

        let attachmentPath;

        // if `attachmentUrl` is null, then it is local attachment
        if (!attachmentUrl) {
          // then store the attachment path only
          // url will be constructed in `useAttachmentCell`
          attachmentPath = `download/${filePath.join('/')}/${fileName}`;
        }

        return {
          ...(attachmentUrl ? { url: attachmentUrl } : {}),
          ...(attachmentPath ? { path: attachmentPath } : {}),
          title: fileName,
          mimetype: urlMeta.mimetype,
          size: urlMeta.size,
          icon: mimeIcons[path.extname(fileName).slice(1)] || undefined,
        };
      }),
    );

    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'url',
    });
    return attachments;
  }

  async fileRead(param: { path: string }) {
    // get the local storage adapter to display local attachments
    const storageAdapter = new Local();
    const type =
      mimetypes[path.extname(param.path).split('/').pop().slice(1)] ||
      'text/plain';

    const img = await storageAdapter.validateAndNormalisePath(
      slash(param.path),
      true,
    );
    return { img, type };
  }

  sanitizeUrlPath(paths) {
    return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
  }
}
