export * from 'src/utils/envs';
export const isWorker =
  process.env.NC_WORKER_MODE_ENABLED === 'true' ||
  process.env.NC_WORKER_CONTAINER === 'true';
export const isMuxEnabled = process.env.NC_DISABLE_MUX !== 'true';
