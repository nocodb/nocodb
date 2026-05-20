import path from 'path';
import fs from 'fs';
import mime from 'mime/lite';
import slash from 'slash';
import { PublicAttachmentScope } from 'nocodb-sdk';
import { nanoid } from 'nanoid';
import moment from 'dayjs';
import hash from 'object-hash';
import type { Response } from 'express';
import type { NcContext } from 'nocodb-sdk';
import type { Column } from '~/models';
import type { AttachmentsService } from '~/services/attachments.service';
import { getToolDir } from '~/utils/nc-config';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PresignedUrl } from '~/models';
import { isSecureAttachmentEnabled } from '~/utils';

export const imageMimeTypes = [
  'image/aces',
  'image/apng',
  'image/avci',
  'image/avcs',
  'image/avif',
  'image/bmp',
  'image/cgm',
  'image/dicom-rle',
  'image/dpx',
  'image/emf',
  'image/example',
  'image/fits',
  'image/g3fax',
  'image/gif',
  'image/heic',
  'image/heic-sequence',
  'image/heif',
  'image/heif-sequence',
  'image/hej2k',
  'image/hsj2',
  'image/ief',
  'image/j2c',
  'image/jaii',
  'image/jais',
  'image/jls',
  'image/jp2',
  'image/jpeg',
  'image/jph',
  'image/jphc',
  'image/jpm',
  'image/jpx',
  'image/jxl',
  'image/jxr',
  'image/jxrA',
  'image/jxrS',
  'image/jxs',
  'image/jxsc',
  'image/jxsi',
  'image/jxss',
  'image/ktx',
  'image/ktx2',
  'image/naplps',
  'image/png',
  'image/prs.btif',
  'image/prs.pti',
  'image/pwg-raster',
  // 'image/svg+xml', // risk of xss
  'image/t38',
  'image/tiff',
  'image/tiff-fx',
  // All vnd.* types usually not natively supported
  // 'image/vnd.adobe.photoshop',
  // 'image/vnd.airzip.accelerator.azv',
  // 'image/vnd.blockfact.facti',
  // 'image/vnd.clip',
  // 'image/vnd.cns.inf2',
  // 'image/vnd.dece.graphic',
  // 'image/vnd.djvu',
  // 'image/vnd.dwg',
  // 'image/vnd.dxf',
  // 'image/vnd.dvb.subtitle',
  // 'image/vnd.fastbidsheet',
  // 'image/vnd.fpx',
  // 'image/vnd.fst',
  // 'image/vnd.fujixerox.edmics-mmr',
  // 'image/vnd.fujixerox.edmics-rlc',
  // 'image/vnd.globalgraphics.pgb',
  // 'image/vnd.microsoft.icon',
  // 'image/vnd.mix',
  // 'image/vnd.ms-modi',
  // 'image/vnd.mozilla.apng',
  // 'image/vnd.net-fpx',
  // 'image/vnd.pco.b16',
  // 'image/vnd.radiance',
  // 'image/vnd.sealed.png',
  // 'image/vnd.sealedmedia.softseal.gif',
  // 'image/vnd.sealedmedia.softseal.jpg',
  // 'image/vnd.svf',
  // 'image/vnd.tencent.tap',
  // 'image/vnd.valve.source.texture',
  // 'image/vnd.wap.wbmp',
  // 'image/vnd.xiff',
  // 'image/vnd.zbrush.pcx',
  'image/webp',
  'image/wmf',
  'image/x-emf',
  'image/x-wmf',
];
const previewableMimeTypes = [...imageMimeTypes, 'pdf', 'video', 'audio'];

export function isPreviewAllowed(args: { mimetype?: string; path?: string }) {
  const { mimetype, path } = args;

  if (mimetype) {
    return previewableMimeTypes.some((type) => mimetype.includes(type));
  } else if (path) {
    const ext = path.split('.').pop();

    // clear query params
    const extWithoutQuery = ext?.split('?')[0];

    if (extWithoutQuery) {
      const mimeType = mime.getType(extWithoutQuery);
      return previewableMimeTypes.some((type) => mimeType?.includes(type));
    }
  }

  return false;
}

// method for validate/normalise the path for avoid path traversal attack
export function validateAndNormaliseLocalPath(
  fileOrFolderPath: string,
  throw404 = false,
): string {
  fileOrFolderPath = slash(fileOrFolderPath);

  const toolDir = getToolDir();

  // Get the absolute path to the base directory
  const absoluteBasePath = path.resolve(toolDir, 'nc');

  // Get the absolute path to the file
  const absolutePath = path.resolve(
    path.join(toolDir, ...fileOrFolderPath.replace(toolDir, '').split('/')),
  );

  // Check if the resolved path is within the intended directory
  // Split by separator and rejoin for equivalence to prevent prefix bypass
  // e.g. /app/data/nc_minimal_dbs would incorrectly pass startsWith('/app/data/nc')
  const baseParts = absoluteBasePath.split(path.sep);
  const targetPrefix = absolutePath
    .split(path.sep)
    .slice(0, baseParts.length)
    .join(path.sep);

  if (targetPrefix !== absoluteBasePath) {
    if (throw404) {
      NcError.notFound();
    } else {
      NcError.badRequest('Invalid path');
    }
  }

  return absolutePath;
}

export function getPathFromUrl(url: string, removePrefix = false) {
  const newUrl = new URL(encodeURI(url));

  const pathName = removePrefix
    ? newUrl.pathname.replace(/.*?nc\/uploads\//, '')
    : newUrl.pathname;

  return decodeURI(`${pathName}${newUrl.search}${newUrl.hash}`);
}

export function resolveAttachmentFilePath(attachment: {
  path?: string;
  url?: string;
}): string {
  if (attachment.path) {
    return path.join(
      'nc',
      'uploads',
      attachment.path.replace(/^download[/\\]/i, ''),
    );
  } else if (attachment.url) {
    return getPathFromUrl(attachment.url).replace(/^\/+/, '');
  }

  throw new Error('Attachment must have either path or url');
}

export const localFileExists = (path: string) => {
  return fs.promises
    .access(path)
    .then(() => true)
    .catch(() => false);
};

export const ATTACHMENT_ROOTS = [
  'thumbnails',
  PublicAttachmentScope.WORKSPACEPICS,
  PublicAttachmentScope.PROFILEPICS,
  PublicAttachmentScope.ORGANIZATIONPICS,
];

export const validateNumberOfFilesInCell = async (
  _context: NcContext,
  _number: number,
  _column: Column,
) => {};

// ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html - extended with some more characters
const normalizeFilename = (filename: string) => {
  return filename.replace(/[\\/:*?"<>'`#|%~{}[\]^]/g, '_');
};

export const getFileNameFromUrl = (param: { url: string; scope?: string }) => {
  const originalFileName =
    param.url.split('/').pop()?.split('?')[0] || 'attachment';
  const fileName = param.scope
    ? `${normalizeFilename(path.parse(originalFileName).name)}${path.extname(
        originalFileName,
      )}`
    : `${normalizeFilename(path.parse(originalFileName).name)}_${nanoid(
        5,
      )}${path.extname(originalFileName)}`;
  return { originalFileName, fileName };
};

export interface AttachmentFilePathConstructed {
  workspaceId?: string;
  baseId: string;
  modelId: string;
  columnId: string;
  scope?: string;

  filePath: string;
  destPath: string;
  fileName: string;
  originalFileName: string;
  storageDest: string;
}

export const constructFilePath = (
  context: NcContext,
  param: {
    fileName: string;
    originalFileName: string;
    modelId: string;
    columnId: string;
    scope?: string;
  },
) => {
  let filePath = path.join(
    ...[
      // somehow, even in production gui upload doesn't use workspace id
      'noco', // context.workspace_id,
      context.base_id,
      param.modelId,
      param.columnId,
      param.scope ? nanoid(5) : undefined,
    ].filter((k) => k),
  );

  if (param.scope) {
    filePath = hash(context.user.id);
  } else if (isSecureAttachmentEnabled) {
    filePath = `${moment().format('YYYY/MM/DD')}/${hash(context.user.id)}`;
  }

  const destPath = path.join(...['nc', param.scope ?? 'uploads', filePath]);

  return {
    workspaceId: context.workspace_id,
    baseId: context.base_id,
    modelId: param.modelId,
    columnId: param.columnId,
    scope: param.scope,
    filePath,
    destPath,
    fileName: param.fileName,
    originalFileName: param.originalFileName,
    storageDest: slash(path.join(destPath, param.fileName)),
  } as AttachmentFilePathConstructed;
};

/**
 * Reject paths that escape `nc/uploads` via traversal segments. `path.join`
 * normalises ".." but does not prevent the result from leaving the base
 * directory — we resolve and verify the prefix explicitly.
 */
export function sanitizeAttachmentStoragePath(joined: string): string {
  const resolved = path.resolve(joined);
  const base = path.resolve('nc', 'uploads');
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid attachment path');
  }
  return joined;
}

export interface ServeStoredAttachmentOptions {
  /**
   * External-storage signed URL TTL in seconds. Caps the post-revocation
   * window — once a signed URL leaves the proxy it cannot be recalled, so
   * the URL itself bounds how long a revoked share can still resolve the
   * file. Defaults to the standard 5-min window.
   */
  signedUrlTtlSeconds?: number;
  /** Cache-Control header value applied to both external + local responses. */
  cacheControl: string;
  /** Local-storage attachments resolver (NestJS service injected by caller). */
  attachmentsService: Pick<AttachmentsService, 'getFile'>;
}

/**
 * Stream a stored attachment to the client. Shared between the authed
 * AttachmentProxy and the anonymous PublicDocs share — different guards,
 * same storage abstraction. External storage → 302 to a short-lived signed
 * URL; local storage → stream the file directly with the same path
 * sanitisation guard.
 */
export async function serveStoredAttachment(
  res: Response,
  fileUrl: string,
  opts: ServeStoredAttachmentOptions,
): Promise<void | Response> {
  const storageAdapter = await NcPluginMgrv2.storageAdapter();
  const isExternalStorage =
    typeof (storageAdapter as any).getSignedUrl === 'function';

  if (isExternalStorage) {
    const isUrl = /^https?:\/\//i.test(fileUrl);

    let pathOrUrl = fileUrl;
    if (!isUrl) {
      const stripped = fileUrl.replace(/^download\//, '');
      pathOrUrl = sanitizeAttachmentStoragePath(
        path.join('nc', 'uploads', stripped),
      );
    }

    const signedUrl = await PresignedUrl.getSignedUrl({
      pathOrUrl,
      preview: true,
      ...(opts.signedUrlTtlSeconds !== undefined && {
        expireSeconds: opts.signedUrlTtlSeconds,
      }),
    });

    res.setHeader('Cache-Control', opts.cacheControl);
    return res.redirect(302, signedUrl);
  }

  const stripped = fileUrl.replace(/^download\//, '');

  try {
    const file = await opts.attachmentsService.getFile({
      path: sanitizeAttachmentStoragePath(path.join('nc', 'uploads', stripped)),
    });

    if (!(await localFileExists(file.path))) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Cache-Control', opts.cacheControl);

    if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
      res.sendFile(file.path);
    } else {
      res.download(file.path);
    }
  } catch {
    res.status(404).send('Not found');
  }
}
