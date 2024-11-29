import path from 'path';
import fs from 'fs';
import mime from 'mime/lite';
import slash from 'slash';
import { PublicAttachmentScope } from 'nocodb-sdk';
import { getToolDir } from '~/utils/nc-config';
import { NcError } from '~/helpers/catchError';

const previewableMimeTypes = ['image', 'pdf', 'video', 'audio'];

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
  if (!absolutePath.startsWith(absoluteBasePath)) {
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
