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
};

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
};

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
};

export const SyncCategoryMeta = {
  [SyncCategory.TICKETING]: {
    value: SyncCategory.TICKETING,
    label: 'Ticketing',
    description: 'Sync data from a ticketing system',
    icon: 'ncBookOpen',
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
    description: 'Sync data from a CRM',
    icon: 'ncUsers',
  },
  [SyncCategory.FILE_STORAGE]: {
    value: SyncCategory.FILE_STORAGE,
    label: 'File Storage',
    description: 'Sync data from a file storage system',
    icon: 'ncFolder',
  },
  [SyncCategory.CUSTOM]: {
    value: SyncCategory.CUSTOM,
    label: 'Custom',
    description: 'Sync data from a dynamic source',
    icon: 'ncDatabase',
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
  [TARGET_TABLES.HRIS_BANK_INFO]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_BANK_INFO,
    icon: 'ncDatabase',
    label: 'HR - Bank Info',
    description: 'Represents human resources bank information data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_BENEFIT]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_BENEFIT,
    icon: 'ncDatabase',
    label: 'HR - Benefit',
    description: 'Represents human resources benefit data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_COMPANY]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_COMPANY,
    icon: 'ncDatabase',
    label: 'HR - Company',
    description: 'Represents human resources company data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_DEPENDENT]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_DEPENDENT,
    icon: 'ncUsers',
    label: 'HR - Dependent',
    description: 'Represents human resources dependent data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_EMPLOYEE]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_EMPLOYEE,
    icon: 'ncUsers',
    label: 'HR - Employee',
    description: 'Represents human resources employee data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_EMPLOYEE_PAYROLL_RUN]: {
    category: SyncCategory.HRIS,
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
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_EMPLOYMENT,
    icon: 'ncDatabase',
    label: 'HR - Employment',
    description: 'Represents human resources employment data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_GROUP]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_GROUP,
    icon: 'ncUsers',
    label: 'HR - Group',
    description: 'Represents human resources group data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_LOCATION]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_LOCATION,
    icon: 'ncDatabase',
    label: 'HR - Location',
    description: 'Represents human resources location data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_PAYROLL_RUN]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_PAYROLL_RUN,
    icon: 'ncDatabase',
    label: 'HR - Payroll Run',
    description: 'Represents human resources payroll run data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_TIME_OFF]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_TIME_OFF,
    icon: 'ncDatabase',
    label: 'HR - Time Off',
    description: 'Represents human resources time off data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_TIME_OFF_BALANCE]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_TIME_OFF_BALANCE,
    icon: 'ncDatabase',
    label: 'HR - Time Off Balance',
    description: 'Represents human resources time off balance data.',
    required: false,
  },
  [TARGET_TABLES.HRIS_TIMESHEET_ENTRY]: {
    category: SyncCategory.HRIS,
    value: TARGET_TABLES.HRIS_TIMESHEET_ENTRY,
    icon: 'ncDatabase',
    label: 'HR - Timesheet Entry',
    description: 'Represents human resources timesheet entry data.',
    required: false,
  },
};
