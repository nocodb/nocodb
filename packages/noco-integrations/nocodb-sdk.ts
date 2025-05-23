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

export enum SyncCategory {
  TICKETING = 'ticketing',
  CRM = 'crm',
  FILE_STORAGE = 'file_storage',
}

export const SyncTriggerMeta = {
  [SyncTrigger.Manual]: {
    value: SyncTrigger.Manual,
    label: 'Manual',
    description: 'Sync data manually',
  },
  [SyncTrigger.Schedule]: {
    value: SyncTrigger.Schedule,
    label: 'Scheduled',
    description: 'Sync data on a schedule',
  },
  [SyncTrigger.Webhook]: {
    value: SyncTrigger.Webhook,
    label: 'Webhook',
    description: 'Sync data via a webhook',
  },
}

export const OnDeleteActionMeta = {
  [OnDeleteAction.Delete]: {
    value: OnDeleteAction.Delete,
    label: 'Delete',
    description: 'Delete data permanently in NocoDB',
  },
  [OnDeleteAction.MarkDeleted]: {
    value: OnDeleteAction.MarkDeleted,
    label: 'Mark Deleted',
    description: 'Mark data as deleted in NocoDB',
  },
}

export const SyncTypeMeta = {
  [SyncType.Full]: {
    value: SyncType.Full,
    label: 'Full',
    description: 'Sync all data',
  },
  [SyncType.Incremental]: {
    value: SyncType.Incremental,
    label: 'Incremental',
    description: 'Sync only new and updated data',
  },
}

export const SyncCategoryMeta = {
  [SyncCategory.TICKETING]: {
    value: SyncCategory.TICKETING,
    label: 'Ticketing',
    description: 'Sync data from a ticketing system',
    icon: 'ncBookOpen',
  },
  [SyncCategory.CRM]: {
    value: SyncCategory.CRM,
    label: 'CRM',
    description: 'Sync data from a CRM',
    icon: 'ncUsers',
  },
  [SyncCategory.FILE_STORAGE]: {
    value: SyncCategory.FILE_STORAGE,
    label: 'File Storage',
    description: 'Sync data from a file storage system',
    icon: 'ncFolder',
  },
}

export enum TARGET_TABLES {
  TICKETING_TICKET = 'ticketing_ticket',
  TICKETING_USER = 'ticketing_user',
  TICKETING_COMMENT = 'ticketing_comment',
  TICKETING_TEAM = 'ticketing_team',
}

export const TARGET_TABLES_META = {
  [TARGET_TABLES.TICKETING_TICKET]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_TICKET,
    icon: 'ncBookOpen',
    label: 'Ticket',
    description: 'Sync all ticket data from the source',
    required: true,
  },
  [TARGET_TABLES.TICKETING_USER]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_USER,
    icon: 'ncUsers',
    label: 'User',
    description: 'Sync all users on tickets from the source',
    required: true,
  },
  [TARGET_TABLES.TICKETING_COMMENT]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_COMMENT,
    icon: 'ncMessageCircle',
    label: 'Comment',
    description: 'Sync all comments on tickets',
    required: false,
  },
  [TARGET_TABLES.TICKETING_TEAM]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_TEAM,
    icon: 'ncUsers',
    label: 'Team',
    description: 'Sync all teams from the source',
    required: false,
  },
}
