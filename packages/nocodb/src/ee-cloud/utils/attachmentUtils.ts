import { extname } from 'node:path';
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
    // Microsoft Office formats
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-powerpoint', // .ppt
    'application/rtf', // .rtf

    // OpenDocument formats (LibreOffice/OpenOffice)
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'application/vnd.oasis.opendocument.presentation', // .odp
    'application/vnd.oasis.opendocument.graphics', // .odg
    'application/vnd.oasis.opendocument.chart', // .odc
    'application/vnd.oasis.opendocument.formula', // .odf
    'application/vnd.oasis.opendocument.database', // .odb
    'application/vnd.oasis.opendocument.image', // .odi
    'application/vnd.oasis.opendocument.text-master', // .odm
    'application/vnd.oasis.opendocument.text-web', // .oth

    // Flat OpenDocument formats
    'application/vnd.oasis.opendocument.text-flat-xml', // .fodt
    'application/vnd.oasis.opendocument.spreadsheet-flat-xml', // .fods
    'application/vnd.oasis.opendocument.presentation-flat-xml', // .fodp
    'application/vnd.oasis.opendocument.graphics-flat-xml', // .fodg

    // Legacy formats
    'application/vnd.sun.xml.writer', // .sxw (OpenOffice 1.x Writer)
    'application/vnd.sun.xml.calc', // .sxc (OpenOffice 1.x Calc)
    'application/vnd.sun.xml.impress', // .sxi (OpenOffice 1.x Impress)
    'application/vnd.sun.xml.draw', // .sxd (OpenOffice 1.x Draw)
    'application/vnd.sun.xml.math', // .sxm (OpenOffice 1.x Math)
    'application/vnd.sun.xml.writer.global', // .sxg (OpenOffice 1.x Master Document)
    'application/vnd.sun.xml.writer.template', // .stw (OpenOffice 1.x Writer Template)
    'application/vnd.sun.xml.calc.template', // .stc (OpenOffice 1.x Calc Template)
    'application/vnd.sun.xml.impress.template', // .sti (OpenOffice 1.x Impress Template)
    'application/vnd.sun.xml.draw.template', // .std (OpenOffice 1.x Draw Template)

    // Other office formats
    'application/vnd.lotus-1-2-3', // .123 (Lotus 1-2-3)
    'application/x-abiword', // .abw (AbiWord)
    'application/x-gnumeric', // .gnumeric (Gnumeric)
  ];

  const officeExtensions = [
    // Microsoft Office
    '.docx',
    '.doc',
    '.xlsx',
    '.xls',
    '.pptx',
    '.ppt',
    '.rtf',

    // OpenDocument formats
    '.odt',
    '.ods',
    '.odp',
    '.odg',
    '.odc',
    '.odf',
    '.odb',
    '.odi',
    '.odm',
    '.oth',

    // Flat OpenDocument formats
    '.fodt',
    '.fods',
    '.fodp',
    '.fodg',

    // OpenOffice 1.x formats
    '.sxw',
    '.sxc',
    '.sxi',
    '.sxd',
    '.sxm',
    '.sxg',
    '.stw',
    '.stc',
    '.sti',
    '.std',

    // Other office formats
    '.abw',
    '.gnumeric',

    // Additional LibreOffice template formats
    '.ott', // OpenDocument Text Template
    '.ots', // OpenDocument Spreadsheet Template
    '.otp', // OpenDocument Presentation Template
    '.otg', // OpenDocument Graphics Template
    '.otf', // OpenDocument Formula Template
    '.oth', // OpenDocument Text Web Template

    // Legacy Microsoft templates
    '.dot', // Word Document Template
    '.xlt', // Excel Template
    '.pot', // PowerPoint Template
    '.dotx', // Word 2007+ Template
    '.xltx', // Excel 2007+ Template
    '.potx', // PowerPoint 2007+ Template
    '.dotm', // Word Macro-Enabled Template
    '.xltm', // Excel Macro-Enabled Template
    '.potm', // PowerPoint Macro-Enabled Template

    // Additional Microsoft formats
    '.docm', // Word Macro-Enabled Document
    '.xlsm', // Excel Macro-Enabled Workbook
    '.pptm', // PowerPoint Macro-Enabled Presentation
    '.xlsb', // Excel Binary Workbook

    '.tsv', // Tab Separated Values
    '.txt', // Plain text (when opened in office apps)
  ];

  // Normalize file extension to lowercase and ensure it starts with a dot
  const normalizedExtension = fileExtension.startsWith('.')
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
  const fileExtension = extname(filename);

  return (
    mimetype?.startsWith('image/') ||
    mimetype?.startsWith('application/pdf') ||
    isOfficeDocument(mimetype || '', fileExtension)
  );
};
