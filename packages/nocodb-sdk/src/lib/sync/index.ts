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
  },
  [SyncCategory.FILE_STORAGE]: {
    value: SyncCategory.FILE_STORAGE,
    label: 'File Storage',
    description: 'Sync files, folders, and metadata.',
    icon: 'ncFolder',
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
  HRIS_EMPLOYEE = 'hris_employee',

  // one by one will be enabled
  // HRIS_BANK_INFO = 'hris_bank_info',
  // HRIS_BENEFIT = 'hris_benefit',
  // HRIS_COMPANY = 'hris_company',
  // HRIS_DEPENDENT = 'hris_dependent',
  // HRIS_EMPLOYEE_PAYROLL_RUN = 'hris_employee_payroll_run',
  HRIS_EMPLOYMENT = 'hris_employment',
  // HRIS_GROUP = 'hris_group',
  HRIS_LOCATION = 'hris_location',
  // HRIS_PAYROLL_RUN = 'hris_payroll_run',
  // HRIS_TIME_OFF = 'hris_time_off',
  // HRIS_TIME_OFF_BALANCE = 'hris_time_off_balance',
  // HRIS_TIMESHEET_ENTRY = 'hris_timesheet_entry',

  // some not prioritized HRIS tables are commented
  // HRIS_EMPLOYER_BENEFIT = 'hris_employer_benefit',

  FILE_STORAGE_FILE = 'fs_file',
  FILE_STORAGE_FOLDER = 'fs_folder',

  CRM_ACCOUNT = 'crm_account',
  // CRM_ASSOCIATION = 'crm_association',
  // CRM_ASSOCIATION_TYPE = 'crm_association_type',
  CRM_CONTACT = 'crm_contact',
  // CRM_CUSTOM_OBJECT = 'crm_custom_object',
  // CRM_CUSTOM_OBJECT_CLASS = 'crm_custom_object_class',
  // CRM_ENGAGEMENT = 'crm_engagement',
  // CRM_ENGAGEMENT_TYPE = 'crm_engagement_type',
  // CRM_LEAD = 'crm_lead',
  // CRM_NOTE = 'crm_note',
  // CRM_OPPORTUNITY = 'crm_opportunity',
  // CRM_STAGE = 'crm_stage',
  // CRM_TASK = 'crm_task',
  CRM_USER = 'crm_user',
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
  [TARGET_TABLES.HRIS_EMPLOYEE]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_EMPLOYEE,
    icon: 'ncUsers',
    label: 'HR_Employee',
    description: 'Represents human resources employee data.',
    required: true,
  },
  [TARGET_TABLES.FILE_STORAGE_FILE]: {
    category: SyncCategory.FILE_STORAGE,
    value: TARGET_TABLES.FILE_STORAGE_FILE,
    icon: 'file',
    label: 'FS_File',
    description: 'Represents file storage file metadata.',
    required: false,
  },
  [TARGET_TABLES.FILE_STORAGE_FOLDER]: {
    category: SyncCategory.FILE_STORAGE,
    value: TARGET_TABLES.FILE_STORAGE_FOLDER,
    icon: 'ncFolder',
    label: 'FS_Folder',
    description: 'Represents file storage folder metadata.',
    required: false,
  },
  // [TARGET_TABLES.HRIS_BANK_INFO]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_BANK_INFO,
  //   icon: 'ncDatabase',
  //   label: 'HR_Bank Info',
  //   description: 'Represents human resources bank information data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_BENEFIT]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_BENEFIT,
  //   icon: 'ncDatabase',
  //   label: 'HR_Benefit',
  //   description: 'Represents human resources benefit data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_COMPANY]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_COMPANY,
  //   icon: 'ncDatabase',
  //   label: 'HR_Company',
  //   description: 'Represents human resources company data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_DEPENDENT]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_DEPENDENT,
  //   icon: 'ncUsers',
  //   label: 'HR_Dependent',
  //   description: 'Represents human resources dependent data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_EMPLOYEE_PAYROLL_RUN]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_EMPLOYEE_PAYROLL_RUN,
  //   icon: 'ncDatabase',
  //   label: 'HR_Employee Payroll Run',
  //   description: 'Represents human resources employee payroll run data.',
  //   required: false,
  // },
  [TARGET_TABLES.HRIS_EMPLOYMENT]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_EMPLOYMENT,
    icon: 'ncDatabase',
    label: 'HR_Employment',
    description: 'Represents human resources employment data.',
    required: false,
  },
  // [TARGET_TABLES.HRIS_GROUP]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_GROUP,
  //   icon: 'ncUsers',
  //   label: 'HR_Group',
  //   description: 'Represents human resources group data.',
  //   required: false,
  // },
  [TARGET_TABLES.HRIS_LOCATION]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_LOCATION,
    icon: 'ncDatabase',
    label: 'HR_Location',
    description: 'Represents human resources location data.',
    required: false,
  },
  // [TARGET_TABLES.HRIS_PAYROLL_RUN]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_PAYROLL_RUN,
  //   icon: 'ncDatabase',
  //   label: 'HR - Payroll Run',
  //   description: 'Represents human resources payroll run data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_TIME_OFF]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_TIME_OFF,
  //   icon: 'ncDatabase',
  //   label: 'HR - Time Off',
  //   description: 'Represents human resources time off data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_TIME_OFF_BALANCE]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_TIME_OFF_BALANCE,
  //   icon: 'ncDatabase',
  //   label: 'HR - Time Off Balance',
  //   description: 'Represents human resources time off balance data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_TIMESHEET_ENTRY]: {
  //   category: SyncCategory.HRIS,
  //   value: TARGET_TABLES.HRIS_TIMESHEET_ENTRY,
  //   icon: 'ncDatabase',
  //   label: 'HR - Timesheet Entry',
  //   description: 'Represents human resources timesheet entry data.',
  //   required: false,
  // },
  // [TARGET_TABLES.HRIS_EMPLOYER_BENEFIT]: {
  //   category: SyncCategory.CUSTOM,
  //   value: TARGET_TABLES.HRIS_EMPLOYER_BENEFIT,
  //   icon: 'ncDatabase',
  //   label: 'HR - Employer Benefit',
  //   description: 'Represents human resources employer benefit data.',
  //   required: false,
  // },

  [TARGET_TABLES.CRM_ACCOUNT]: {
    category: SyncCategory.CRM,
    value: TARGET_TABLES.CRM_ACCOUNT,
    icon: 'ncUsers',
    label: 'CRM_Account',
    description: 'Represents crm account data.',
    required: true,
  },
  // [TARGET_TABLES.CRM_ASSOCIATION]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_ASSOCIATION,
  //   icon: 'link2',
  //   label: 'CRM_Association',
  //   description: 'Represents crm association data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_ASSOCIATION_TYPE]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_ASSOCIATION_TYPE,
  //   icon: 'label',
  //   label: 'CRM_Association_type',
  //   description: 'Represents crm association types data.',
  //   required: false,
  // },
  [TARGET_TABLES.CRM_CONTACT]: {
    category: SyncCategory.CRM,
    value: TARGET_TABLES.CRM_CONTACT,
    icon: 'ncUsers',
    label: 'CRM_Contact',
    description: 'Represents crm contact data.',
    required: true,
  },
  // [TARGET_TABLES.CRM_CUSTOM_OBJECT]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_CUSTOM_OBJECT,
  //   icon: 'box',
  //   label: 'CRM_Custom_Object',
  //   description: 'Represents crm custom object data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_CUSTOM_OBJECT_CLASS]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_CUSTOM_OBJECT_CLASS,
  //   icon: 'layers',
  //   label: 'CRM_Custom_Object_Class',
  //   description: 'Represents crm custom object class data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_ENGAGEMENT]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_ENGAGEMENT,
  //   icon: 'message-square',
  //   label: 'CRM_Engagement',
  //   description: 'Represents crm engagement data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_ENGAGEMENT_TYPE]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_ENGAGEMENT_TYPE,
  //   icon: 'tag',
  //   label: 'CRM_Engagement_Type',
  //   description: 'Represents crm engagement type data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_LEAD]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_LEAD,
  //   icon: 'user-plus',
  //   label: 'CRM_Lead',
  //   description: 'Represents crm lead data.',
  //   required: true,
  // },
  // [TARGET_TABLES.CRM_NOTE]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_NOTE,
  //   icon: 'file-text',
  //   label: 'CRM_Note',
  //   description: 'Represents crm note data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_OPPORTUNITY]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_OPPORTUNITY,
  //   icon: 'trending-up',
  //   label: 'CRM_Opportunity',
  //   description: 'Represents crm opportunity data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_STAGE]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_STAGE,
  //   icon: 'sliders',
  //   label: 'CRM_Stage',
  //   description: 'Represents crm stage data.',
  //   required: false,
  // },
  // [TARGET_TABLES.CRM_TASK]: {
  //   category: SyncCategory.CRM,
  //   value: TARGET_TABLES.CRM_TASK,
  //   icon: 'check-square',
  //   label: 'CRM_Task',
  //   description: 'Represents crm task data.',
  //   required: false,
  // },
  [TARGET_TABLES.CRM_USER]: {
    category: SyncCategory.CRM,
    value: TARGET_TABLES.CRM_USER,
    icon: 'user',
    label: 'CRM_User',
    description: 'Represents crm user data.',
    required: true,
  },
};
