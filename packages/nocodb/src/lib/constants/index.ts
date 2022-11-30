export const NC_LICENSE_KEY = 'nc-license-key';
export const NC_APP_SETTINGS = 'nc-app-settings';
export const NC_FILE_FIELD_SIZE = process.env['NC_FILE_FIELD_SIZE']
  ? Number(process.env['NC_FILE_FIELD_SIZE'])
  : 250 * 1024 * 1024; // 250 MB
