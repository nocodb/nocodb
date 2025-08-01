import { PublicAttachmentScope } from 'nocodb-sdk';

export const NC_LICENSE_KEY = 'nc-license-key';
export const NC_APP_SETTINGS = 'nc-app-settings';
export const NC_NON_ATTACHMENT_FIELD_SIZE =
  +process.env['NC_NON_ATTACHMENT_FIELD_SIZE'] || 10 * 1024 * 1024; // 10 MB
export const NC_ATTACHMENT_FIELD_SIZE =
  +process.env['NC_ATTACHMENT_FIELD_SIZE'] || 20 * 1024 * 1024; // 20 MB
export const NC_MAX_ATTACHMENTS_ALLOWED =
  +process.env['NC_MAX_ATTACHMENTS_ALLOWED'] || 10;
export const NC_REFRESH_TOKEN_EXP_IN_DAYS =
  parseInt(process.env.NC_REFRESH_TOKEN_EXP_IN_DAYS, 10) || 30;

// throw error if user provided invalid value
if (!NC_REFRESH_TOKEN_EXP_IN_DAYS || NC_REFRESH_TOKEN_EXP_IN_DAYS <= 0) {
  throw new Error('NC_REFRESH_TOKEN_EXP_IN_DAYS must be a positive number');
}

export const NC_MAX_TEXT_LENGTH = 100000;

export const NC_EMAIL_ASSETS_BASE_URL = 'https://cdn.nocodb.com/emails/v2';

export const NC_RECURSIVE_MAX_DEPTH = 7;

export const QUERY_STRING_FIELD_ID_ON_RESULT = 'fieldIdOnResult';

export const S3_PATCH_KEYS = [
  'uploads',
  'thumbnails',
  ...(Object.values(PublicAttachmentScope) as string[]),
];

export const V3_INSERT_LIMIT = 10;
export const MAX_NESTING_DEPTH = 3;
export const MAX_CONCURRENT_TRANSFORMS = 50;
export const NC_ATTACHMENT_URL_MAX_REDIRECT = 3;

export const EMIT_EVENT = {
  HANDLE_ATTACHMENT_URL_UPLOAD: '__nc_handleAttachmentUrlUpload',
};
