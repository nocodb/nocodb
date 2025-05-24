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

export enum FormBuilderInputType {
  Input = 'input',
  Select = 'select',
  Switch = 'switch',
  Space = 'space',
  Password = 'password',
  SelectIntegration = 'integration',
  SelectBase = 'select-base',
  OAuth = 'oauth',
}

export interface FormBuilderCondition {
  // model path to check for condition
  model: string;
  // value to check for condition
  value?: string;
  // check if the value is equal to the model value
  equal?: string;
  // check if the value is in the array
  in?: string[];
  // check if the value is empty
  empty?: boolean;
  // check if the value is not empty
  notEmpty?: boolean;
}

export enum FormBuilderValidatorType {
  Required = 'required',
}

export interface FormBuilderElement {
  // element type
  type: FormBuilderInputType;
  // property path in the form JSON
  model?: string;
  // default value
  defaultValue?: string[] | string | boolean | number | null;
  // label for the element
  label?: string;
  // placeholder for the element (if applicable)
  placeholder?: string;
  // percentage width of the element
  width?: number;
  // category of the element - same category elements are grouped together
  category?: string;
  // help text for the element
  // options for select element
  options?: { value: string; label: string }[];
  // select mode for the element (if applicable) - default is single
  selectMode?: 'single' | 'multiple' | 'multipleWithInput';
  // integration type filter for integration element
  integrationFilter?: {
    type?: string;
    sub_type?: string;
  };
  // oauth meta
  oauthMeta?: {
    // oauth provider
    provider: string;
    // oauth auth uri
    authUri: string;
    // oauth redirect uri
    redirectUri: string;
    // client id
    clientId: string;
    // code key (code by default)
    codeKey?: string;
    // oauth scopes
    scopes?: string[];
  };
  // condition for the element to be visible
  condition?: FormBuilderCondition | FormBuilderCondition[];
  // border for the element (if applicable) - default is false
  border?: boolean;
  // show hint as tooltip for the element (if applicable) - default is false
  showHintAsTooltip?: boolean;
  // validators for the element
  validators?: { type: FormBuilderValidatorType; message?: string }[];
  // fetch options for the element using key
  fetchOptionsKey?: string;
}

export type FormDefinition = FormBuilderElement[];

export const FORM_BUILDER_NON_CATEGORIZED = 'form-builder-non-categorized';

