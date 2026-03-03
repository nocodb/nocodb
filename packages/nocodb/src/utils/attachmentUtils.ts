import { ncIsNumber } from 'nocodb-sdk';
import { imageMimeTypes } from '~/helpers/attachmentHelpers';
import { getThumbnailMaxSize } from '~/utils/nc-config/constants';

export const isOfficeDocument = (..._args) => {
  return false;
};

export const supportsThumbnails = (attachment: any) => {
  const mimetype = attachment.mimetype || attachment.mimeType;
  const size = attachment.size;

  // Skip thumbnail generation if size is missing, not a number, or exceeds limit
  if (!size || !ncIsNumber(size) || size > getThumbnailMaxSize()) {
    return false;
  }

  return !!imageMimeTypes.includes(mimetype);
};
