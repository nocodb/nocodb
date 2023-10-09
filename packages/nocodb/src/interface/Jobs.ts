export const JOBS_QUEUE = 'jobs';

export enum JobTypes {
  DuplicateBase = 'duplicate-source',
  DuplicateModel = 'duplicate-model',
  AtImport = 'at-import',
  MetaSync = 'meta-sync',
  BaseCreate = 'base-create',
  BaseDelete = 'base-delete',
  UpdateModelStat = 'update-model-stat',
  UpdateWsStat = 'update-ws-stats',
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
