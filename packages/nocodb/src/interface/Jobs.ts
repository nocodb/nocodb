export const JOBS_QUEUE = 'jobs';

export enum JobTypes {
  DuplicateBase = 'duplicate-base',
  DuplicateModel = 'duplicate-model',
  DuplicateColumn = 'duplicate-column',
  AtImport = 'at-import',
  MetaSync = 'meta-sync',
  SourceCreate = 'source-create',
  SourceDelete = 'source-delete',
  UpdateModelStat = 'update-model-stat',
  UpdateWsStat = 'update-ws-stats',
  UpdateSrcStat = 'update-source-stat',
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

export const InstanceTypes = {
  PRIMARY: `${process.env.NC_ENV ?? 'default'}-primary`,
  WORKER: `${process.env.NC_ENV ?? 'default'}-worker`,
};

export enum InstanceCommands {
  RESUME_LOCAL = 'resumeLocal',
  PAUSE_LOCAL = 'pauseLocal',
  RESET = 'reset',
  RELEASE = 'release',
}
