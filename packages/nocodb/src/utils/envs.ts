export const isWorker = false;
export const isMuxEnabled = false;
export const isSecureAttachmentEnabled =
  process.env.NC_ATTACHMENT_ACCESS_CONTROL_ENABLED === 'true' ||
  process.env.NC_SECURE_ATTACHMENTS === 'true';
export const ncSiteUrl = process.env.NC_SITE_URL || process.env.NC_PUBLIC_URL;
