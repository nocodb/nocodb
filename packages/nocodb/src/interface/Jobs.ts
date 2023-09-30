export const JOBS_QUEUE = 'jobs';

export enum JobTypes {
  DuplicateBase = 'duplicate-base',
  DuplicateModel = 'duplicate-model',
  AtImport = 'at-import',
  MetaSync = 'meta-sync',
  BaseCreate = 'base-create',
  BaseDelete = 'base-delete',
}

export enum JobStatus {
  COMPLETED = 'completed',
  WAITING = 'waiting',
  ACTIVE = 'active',
  DELAYED = 'delayed',
  FAILED = 'failed',
  PAUSED = 'paused',
  REFRESH = 'refresh',
}

export enum JobEvents {
  STATUS = 'job.status',
  LOG = 'job.log',
}
