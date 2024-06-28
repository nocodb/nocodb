import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
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
  HealthCheck = 'health-check',
  HandleWebhook = 'handle-webhook',
  CleanUp = 'clean-up',
  DataExport = 'data-export',
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

export interface JobData {
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
  };
  modelId: string;
  viewId: string;
  exportAs: 'csv' | 'json' | 'xlsx';
  ncSiteUrl: string;
}
