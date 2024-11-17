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
