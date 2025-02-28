export enum SyncType {
  Full = 'full',
  Incremental = 'incremental',
}

export enum SyncStatus {
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export enum SyncTrigger {
  Manual = 'manual',
  Polling = 'polling',
  Webhook = 'webhook',
}
