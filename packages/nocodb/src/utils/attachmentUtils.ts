export const isOfficeDocument = (..._args) => {
  return false;
};

export const supportsThumbnails = (attachment: any) => {
  const mimetype = attachment.mimetype || attachment.mimeType;

  return !!(
    mimetype.startsWith('image/') // || mimetype.startsWith('application/pdf')
  );
};
