import { MetaType } from '../Api';

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
  CUSTOM = 'custom',
}

export interface SyncConfig {
  id: string;
  title: string;

  fk_parent_sync_config_id: string | null;

  fk_integration_id: string;

  sync_category: SyncCategory;
  sync_type: SyncType;
  sync_trigger: SyncTrigger;
  sync_trigger_cron?: string;
  sync_trigger_secret: string | null;
  sync_job_id: string;

  last_sync_at: string | null;
  next_sync_at: string | null;

  on_delete_action: OnDeleteAction;

  fk_workspace_id: string;
  base_id: string;

  created_at: string;
  updated_at: string;

  children?: SyncConfig[];
  /**
   * JSON meta information for the sync config
   */
  meta?: MetaType;
}

export const SyncTriggerMeta = {
  [SyncTrigger.Manual]: {
    value: SyncTrigger.Manual,
    label: 'Manual',
    description: 'Sync changes only when explicitly requested.',
  },
  [SyncTrigger.Schedule]: {
    value: SyncTrigger.Schedule,
    label: 'Scheduled',
    description: 'Automatically sync data at predefined time intervals.',
  },
  [SyncTrigger.Webhook]: {
    value: SyncTrigger.Webhook,
    label: 'Webhook',
    description:
      'Sync initiated instantly by external events or system notifications.',
  },
};

export const OnDeleteActionMeta = {
  [OnDeleteAction.MarkDeleted]: {
    value: OnDeleteAction.MarkDeleted,
    label: 'Ignore',
    description: 'Keep records even if the source deletes them.',
  },
  [OnDeleteAction.Delete]: {
    value: OnDeleteAction.Delete,
    label: 'Delete',
    description: 'Remove records when they are deleted at the source.',
  },
};

export const SyncTypeMeta = {
  [SyncType.Incremental]: {
    value: SyncType.Incremental,
    label: 'Incremental',
    description: 'Syncs only new or changed records.',
  },
  [SyncType.Full]: {
    value: SyncType.Full,
    label: 'Full',
    description: 'Syncs all records every run.',
  },
};

export const SyncCategoryMeta = {
  [SyncCategory.TICKETING]: {
    value: SyncCategory.TICKETING,
    label: 'Ticketing',
    description: 'Sync issues, tickets, and related activity.',
    icon: 'ncClipboard',
  },
  [SyncCategory.CRM]: {
    value: SyncCategory.CRM,
    label: 'CRM',
    description: 'Sync customer and lead data.',
    icon: 'ncUsers',
    comingSoon: true,
  },
  [SyncCategory.FILE_STORAGE]: {
    value: SyncCategory.FILE_STORAGE,
    label: 'File Storage',
    description: 'Sync files, folders, and metadata.',
    icon: 'ncFolder',
    comingSoon: true,
  },
  [SyncCategory.CUSTOM]: {
    value: SyncCategory.CUSTOM,
    label: 'Custom',
    description: 'Build a sync for another service or app.',
    icon: 'ncDatabase',
    beta: true,
  },
};

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
    description: 'Represents a ticket, issue, task, or case.',
    required: true,
  },
  [TARGET_TABLES.TICKETING_USER]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_USER,
    icon: 'ncUsers',
    label: 'User',
    description: 'Represents users in the source app.',
    required: true,
  },
  [TARGET_TABLES.TICKETING_COMMENT]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_COMMENT,
    icon: 'ncMessageCircle',
    label: 'Comment',
    description: 'Represents comments added to a ticket.',
    required: false,
  },
  [TARGET_TABLES.TICKETING_TEAM]: {
    category: SyncCategory.TICKETING,
    value: TARGET_TABLES.TICKETING_TEAM,
    icon: 'ncUsers',
    label: 'Team',
    description: 'Represents teams or groups in the source system.',
    required: false,
  },
};
