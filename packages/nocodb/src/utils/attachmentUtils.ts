/**
 * Checks if a file is an Office document based on MIME type and file extension
 * @param mimeType - The MIME type of the file
 * @param fileExtension - The file extension (with or without leading dot)
 * @returns true if the file is an Office document, false otherwise
 */
export function isOfficeDocument(
  mimeType: string,
  fileExtension: string,
): boolean {
  const officeMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-powerpoint', // .ppt
    'application/rtf', // .rtf
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'application/vnd.oasis.opendocument.presentation', // .odp
  ];

  const officeExtensions = [
    '.docx',
    '.doc',
    '.xlsx',
    '.xls',
    '.pptx',
    '.ppt',
    '.rtf',
    '.odt',
    '.ods',
    '.odp',
  ];

  // Normalize file extension to lowercase and ensure it starts with a dot
  const normalizedExtension = fileExtension.toLowerCase().startsWith('.')
    ? fileExtension.toLowerCase()
    : `.${fileExtension.toLowerCase()}`;

  return (
    officeMimeTypes.includes(mimeType) ||
    officeExtensions.includes(normalizedExtension)
  );
}

export const supportsThumbnails = (attachment: any) => {
  const mimetype = attachment.mimetype || attachment.mimeType;
  const filename =
    attachment.title || attachment.filename || attachment.name || '';

  // Extract file extension from filename
  const fileExtension = filename.includes('.')
    ? filename.substring(filename.lastIndexOf('.'))
    : '';

  return (
    mimetype?.startsWith('image/') ||
    mimetype?.startsWith('application/pdf') ||
    isOfficeDocument(mimetype || '', fileExtension)
  );
};
