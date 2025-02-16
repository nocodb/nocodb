import type {
  AttachmentResType,
  PublicAttachmentScope,
  SnapshotType,
  SupportedExportCharset,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
export const JOBS_QUEUE = 'jobs';

export enum MigrationJobTypes {
  Attachment = 'attachment',
  Thumbnail = 'thumbnail',
  RecoverLinks = 'recover-links',
  CleanupDuplicateColumns = 'cleanup-duplicate-columns',
  OrderColumnCreation = 'order-column-creation',
  NoOpMigration = 'no-op-migration',
  RecoverOrderColumnMigration = 'recover-order-column-migration',
}

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
  HealthCheck = 'health-check',
  HandleWebhook = 'handle-webhook',
  CleanUp = 'clean-up',
  DataExport = 'data-export',
  ThumbnailGenerator = 'thumbnail-generator',
  AttachmentCleanUp = 'attachment-clean-up',
  InitMigrationJobs = 'init-migration-jobs',
  UseWorker = 'use-worker',
  CreateSnapshot = 'create-snapshot',
  RestoreSnapshot = 'restore-snapshot',
  ListenImport = 'listen-import',
}

export const SKIP_STORING_JOB_META = [
  JobTypes.HealthCheck,
  JobTypes.ThumbnailGenerator,
  JobTypes.UseWorker,
  JobTypes.HandleWebhook,
  JobTypes.InitMigrationJobs,
  JobTypes.UpdateModelStat,
  JobTypes.UpdateWsStat,
  JobTypes.UpdateSrcStat,
];

export enum JobStatus {
  COMPLETED = 'completed',
  WAITING = 'waiting',
  ACTIVE = 'active',
  DELAYED = 'delayed',
  FAILED = 'failed',
  PAUSED = 'paused',
  REFRESH = 'refresh',
  REQUEUED = 'requeued',
}

export enum JobEvents {
  STATUS = 'job.status',
  LOG = 'job.log',
}

export const JobVersions: {
  [key in JobTypes]?: number;
} = {
  [JobTypes.InitMigrationJobs]: 2,
};

export const JOB_REQUEUED = 'job.requeued';

export const JOB_REQUEUE_LIMIT = 10;

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

export interface JobData {
  // meta info
  jobName: string;
  _jobDelay?: number;
  _jobAttempt?: number;
  _jobVersion?: number;
  // context
  context: NcContext;
  user: Partial<UserType>;
}

export interface AtImportJobData extends JobData {
  syncId: string;
  baseId: string;
  sourceId: string;
  baseName: string;
  authToken: string;
  baseURL: string;
  clientIp: string;
  options?: {
    syncViews?: boolean;
    syncAttachment?: boolean;
    syncLookup?: boolean;
    syncRollup?: boolean;
    syncUsers?: boolean;
    syncData?: boolean;
  };
  user: any;
}

export interface DuplicateBaseJobData extends JobData {
  sourceId: string;
  dupProjectId: string;
  req: NcRequest;
  options: {
    excludeData?: boolean;
    excludeViews?: boolean;
    excludeHooks?: boolean;
    excludeComments?: boolean;
  };
}

export interface DuplicateModelJobData extends JobData {
  sourceId: string;
  modelId: string;
  title: string;
  req: NcRequest;
  options: {
    excludeData?: boolean;
    excludeViews?: boolean;
    excludeHooks?: boolean;
    excludeComments?: boolean;
  };
}

export interface DuplicateColumnJobData extends JobData {
  sourceId: string;
  columnId: string;
  extra: Record<string, any>; // extra data
  req: NcRequest;
  options: {
    excludeData?: boolean;
  };
}

export interface HandleWebhookJobData extends JobData {
  hookId: string;
  modelId: string;
  viewId: string;
  prevData;
  newData;
}

export interface DataExportJobData extends JobData {
  options?: {
    delimiter?: string;
    extension_id?: string;
    encoding?: SupportedExportCharset;
  };
  modelId: string;
  viewId: string;
  exportAs: 'csv' | 'json' | 'xlsx';
  ncSiteUrl: string;
}

export interface ThumbnailGeneratorJobData extends JobData {
  attachments: AttachmentResType[];
  scope?: PublicAttachmentScope;
}

export interface CreateSnapshotJobData extends JobData {
  sourceId: string;
  snapshotBaseId: string;
  req: NcRequest;
  snapshot: SnapshotType;
}

export interface RestoreSnapshotJobData extends JobData {
  sourceId: string;
  targetBaseId: string;
  targetContext: {
    workspace_id: string;
    base_id: string;
  };
  snapshot: SnapshotType;
  req: NcRequest;
}
