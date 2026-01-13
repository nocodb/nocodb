import { imageMimeTypes } from '~/helpers/attachmentHelpers';

export const isOfficeDocument = (..._args) => {
  return false;
};

export const supportsThumbnails = (attachment: any) => {
  const mimetype = attachment.mimetype || attachment.mimeType;

  return !!imageMimeTypes.includes(mimetype);
};
