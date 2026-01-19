import { imageMimeTypes } from '~/helpers/attachmentHelpers';
import { getThumbnailMaxSize } from '~/utils/nc-config/constants';

export const isOfficeDocument = (..._args) => {
  return false;
};

export const supportsThumbnails = (attachment: any) => {
  const mimetype = attachment.mimetype || attachment.mimeType;
  const size = attachment.size;

  // Skip thumbnail generation for files larger than configured limit
  if (!size || size > getThumbnailMaxSize()) {
    return false;
  }

  return !!imageMimeTypes.includes(mimetype);
};
