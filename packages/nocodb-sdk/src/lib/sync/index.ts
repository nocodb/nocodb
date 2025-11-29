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
  HRIS = 'hris',
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
  created_by: string;
  updated_by: string;

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
  [SyncCategory.HRIS]: {
    value: SyncCategory.HRIS,
    label: 'HRIS',
    description: 'Sync employees, leaves and timesheet.',
    icon: 'ncUsers',
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
  HRIS_BANK_INFO = 'hris_bank_info',
  HRIS_BENEFIT = 'hris_benefit',
  HRIS_COMPANY = 'hris_company',
  HRIS_DEPENDENT = 'hris_dependent',
  HRIS_EMPLOYEE = 'hris_employee',
  HRIS_EMPLOYEE_PAYROLL_RUN = 'hris_employee_payroll_run',
  // some not prioritized HRIS tables are commented
  // HRIS_EMPLOYER_BENEFIT = 'hris_employer_benefit',
  HRIS_EMPLOYMENT = 'hris_employment',
  HRIS_GROUP = 'hris_group',
  HRIS_LOCATION = 'hris_location',
  HRIS_PAY_GROUP = 'hris_pay_group',
  HRIS_PAYROLL_RUN = 'hris_payroll_run',
  HRIS_TIME_OFF = 'hris_time_off',
  HRIS_TIME_OFF_BALANCE = 'hris_time_off_balance',
  HRIS_TIMESHEET_ENTRY = 'hris_timesheet_entry',
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
  [TARGET_TABLES.HRIS_BANK_INFO]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_BANK_INFO,
    icon: 'ncDatabase',
    label: 'HR - Bank Info',
    description: 'Represents human resources bank information data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_BENEFIT]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_BENEFIT,
    icon: 'ncDatabase',
    label: 'HR - Benefit',
    description: 'Represents human resources benefit data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_COMPANY]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_COMPANY,
    icon: 'ncDatabase',
    label: 'HR - Company',
    description: 'Represents human resources company data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_DEPENDENT]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_DEPENDENT,
    icon: 'ncUsers',
    label: 'HR - Dependent',
    description: 'Represents human resources dependent data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_EMPLOYEE]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_EMPLOYEE,
    icon: 'ncUsers',
    label: 'HR - Employee',
    description: 'Represents human resources employee data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_EMPLOYEE_PAYROLL_RUN]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_EMPLOYEE_PAYROLL_RUN,
    icon: 'ncDatabase',
    label: 'HR - Employee Payroll Run',
    description: 'Represents human resources employee payroll run data.',
    required: false,
  },
  // [TARGET_TABLES.HRIS_EMPLOYER_BENEFIT]: {
  //   category: SyncCategory.CUSTOM,
  //   value: TARGET_TABLES.HRIS_EMPLOYER_BENEFIT,
  //   icon: 'ncDatabase',
  //   label: 'HR - Employer Benefit',
  //   description: 'Represents human resources employer benefit data.',
  //   required: false,
  // },
  [TARGET_TABLES.HRIS_EMPLOYMENT]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_EMPLOYMENT,
    icon: 'ncDatabase',
    label: 'HR - Employment',
    description: 'Represents human resources employment data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_GROUP]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_GROUP,
    icon: 'ncUsers',
    label: 'HR - Group',
    description: 'Represents human resources group data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_LOCATION]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_LOCATION,
    icon: 'ncDatabase',
    label: 'HR - Location',
    description: 'Represents human resources location data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_PAY_GROUP]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_PAY_GROUP,
    icon: 'ncDatabase',
    label: 'HR - Pay Group',
    description: 'Represents human resources pay group data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_PAYROLL_RUN]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_PAYROLL_RUN,
    icon: 'ncDatabase',
    label: 'HR - Payroll Run',
    description: 'Represents human resources payroll run data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_TIME_OFF]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_TIME_OFF,
    icon: 'ncDatabase',
    label: 'HR - Time Off',
    description: 'Represents human resources time off data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_TIME_OFF_BALANCE]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_TIME_OFF_BALANCE,
    icon: 'ncDatabase',
    label: 'HR - Time Off Balance',
    description: 'Represents human resources time off balance data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_TIMESHEET_ENTRY]: {
    category: SyncCategory.CUSTOM,
    value: TARGET_TABLES.HRIS_TIMESHEET_ENTRY,
    icon: 'ncDatabase',
    label: 'HR - Timesheet Entry',
    description: 'Represents human resources timesheet entry data.',
    required: false,
  },
};
