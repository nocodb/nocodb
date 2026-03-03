export const isWorker =
  process.env.NC_WORKER_MODE_ENABLED === 'true' ||
  process.env.NC_WORKER_CONTAINER === 'true';
export const isMuxEnabled = false;
export const isSecureAttachmentEnabled =
  process.env.NC_ATTACHMENT_ACCESS_CONTROL_ENABLED === 'true' ||
  process.env.NC_SECURE_ATTACHMENTS === 'true';
