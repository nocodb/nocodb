import { ncIsNumber } from 'nocodb-sdk';
import { imageMimeTypes } from '~/helpers/attachmentHelpers';
import { getThumbnailMaxSize } from '~/utils/nc-config/constants';

export const isOfficeDocument = (..._args) => {
  return false;
};

export const supportsThumbnails = (attachment: any) => {
  const mimetype = attachment.mimetype || attachment.mimeType;

  return !!imageMimeTypes.includes(mimetype);
};
