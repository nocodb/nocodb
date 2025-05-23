export enum SyncType {
  Full = 'full',
  Incremental = 'incremental',
}

export enum SyncTrigger {
  Manual = 'manual',
  Schedule = 'schedule',
  Webhook = 'webhook',
}

export enum OnDeleteAction {
  Delete = 'delete',
  MarkDeleted = 'mark_deleted',
}
