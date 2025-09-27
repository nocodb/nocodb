export const isWorker = process.env.NC_WORKER_CONTAINER === 'true';
export const isMuxEnabled = false;
export const isSecureAttachmentEnabled =
  process.env.NC_SECURE_ATTACHMENTS === 'true';
