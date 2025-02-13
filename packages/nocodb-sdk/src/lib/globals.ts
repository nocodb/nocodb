import { OrgUserRoles, ProjectRoles, WorkspaceUserRoles } from './enums';

export const enumColors = {
  light: [
    '#cfdffe',
    '#d0f1fd',
    '#c2f5e8',
    '#ffdaf6',
    '#ffdce5',
    '#fee2d5',
    '#ffeab6',
    '#d1f7c4',
    '#ede2fe',
    '#eeeeee',
  ],
  dark: [
    '#2d7ff999',
    '#18bfff99',
    '#20d9d299',
    '#ff08c299',
    '#f82b6099',
    '#ff6f2c99',
    '#fcb40099',
    '#20c93399',
    '#8b46ff99',
    '#666',
  ],
  get: (theme: 'light' | 'dark', index: number) => {
    index = Math.abs(index) % enumColors[theme].length;
    return enumColors[theme][index];
  },
};

export enum ViewTypes {
  FORM = 1,
  GALLERY = 2,
  GRID = 3,
  KANBAN = 4,
  MAP = 5,
  CALENDAR = 6,
}

export const viewTypeAlias: Record<ViewTypes, string> = {
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
  [ViewTypes.CALENDAR]: 'calendar',
};

export const viewTypeToStringMap: Record<ViewTypes, string> = {
  ...viewTypeAlias,
};

// Generate reverse mapping from the original viewTypeAlias
export const stringToViewTypeMap: Record<string, ViewTypes> = Object.entries(
  viewTypeAlias
).reduce((acc, [key, value]) => {
  acc[value] = Number(key);
  return acc;
}, {});

export enum ProjectTypes {
  DATABASE = 'database',
  DOCUMENTATION = 'documentation',
  COWRITER = 'cowriter',
  DASHBOARD = 'dashboard',
}

export enum RelationTypes {
  HAS_MANY = 'hm',
  BELONGS_TO = 'bt',
  MANY_TO_MANY = 'mm',
  ONE_TO_ONE = 'oo',
}

export const ExpandedFormMode = {
  FIELD: 'field',
  ATTACHMENT: 'attachment',
} as const;

export type ExpandedFormModeType =
  (typeof ExpandedFormMode)[keyof typeof ExpandedFormMode];

export enum ExportTypes {
  EXCEL = 'excel',
  CSV = 'csv',
}

export enum PluginCategory {
  STORAGE = 'Storage',
  EMAIL = 'Email',
}

export enum ModelTypes {
  TABLE = 'table',
  VIEW = 'view',
}

export enum ProjectStatus {
  JOB = 'job',
}

export enum TiptapNodesTypes {
  doc = 'doc',
  sec = 'sec',
  paragraph = 'paragraph',
  text = 'text',
  heading = 'heading',
  bullet = 'bullet',
  ordered = 'ordered',
  task = 'task',
  quote = 'quote',
  divider = 'divider',
  codeBlock = 'codeBlock',
  image = 'image',
  callout = 'callout',
  tipCallout = 'tipCallout',
  table = 'table',
  tableRow = 'tableRow',
  tableCell = 'tableCell',
  embed = 'embed',
  collapsable = 'collapsable',
  collapsableContent = 'collapsable_content',
  collapsableHeader = 'collapsable_header',
  column = 'column',
  columnContent = 'columnContent',
  linkToPage = 'linkToPage',
  attachment = 'attachment',
}

export enum TiptapMarksTypes {
  strike = 'strike',
  bold = 'bold',
  italic = 'italic',
  link = 'link',
  code = 'code',
  underline = 'underline',
}

export enum NcDataErrorCodes {
  NC_ERR_MM_MODEL_NOT_FOUND = 'NC_ERR_MM_MODEL_NOT_FOUND',
}

export enum NcErrorType {
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  API_TOKEN_NOT_ALLOWED = 'API_TOKEN_NOT_ALLOWED',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  BASE_NOT_FOUND = 'BASE_NOT_FOUND',
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  VIEW_NOT_FOUND = 'VIEW_NOT_FOUND',
  FIELD_NOT_FOUND = 'FIELD_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  GENERIC_NOT_FOUND = 'GENERIC_NOT_FOUND',
  HOOK_NOT_FOUND = 'HOOK_NOT_FOUND',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  ERROR_DUPLICATE_RECORD = 'ERROR_DUPLICATE_RECORD',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_OFFSET_VALUE = 'INVALID_OFFSET_VALUE',
  INVALID_PAGE_VALUE = 'INVALID_PAGE_VALUE',
  INVALID_LIMIT_VALUE = 'INVALID_LIMIT_VALUE',
  INVALID_FILTER = 'INVALID_FILTER',
  INVALID_SHARED_VIEW_PASSWORD = 'INVALID_SHARED_VIEW_PASSWORD',
  INVALID_ATTACHMENT_JSON = 'INVALID_ATTACHMENT_JSON',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  BAD_JSON = 'BAD_JSON',
  INVALID_PK_VALUE = 'INVALID_PK_VALUE',
  COLUMN_ASSOCIATED_WITH_LINK = 'COLUMN_ASSOCIATED_WITH_LINK',
  TABLE_ASSOCIATED_WITH_LINK = 'TABLE_ASSOCIATED_WITH_LINK',
  INTEGRATION_NOT_FOUND = 'INTEGRATION_NOT_FOUND',
  INTEGRATION_LINKED_WITH_BASES = 'INTEGRATION_LINKED_WITH_BASES',
  FORMULA_ERROR = 'FORMULA_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_ATTACHMENT_UPLOAD_SCOPE = 'INVALID_ATTACHMENT_UPLOAD_SCOPE',
  CANNOT_CALCULATE_INTERMEDIATE_ORDER = 'CANNOT_CALCULATE_INTERMEDIATE_ORDER',
  REORDER_FAILED = 'REORDER_FAILED',
}

export const LongTextAiMetaProp = 'ai';

export const NO_SCOPE = 'nc';

type Roles = OrgUserRoles | ProjectRoles | WorkspaceUserRoles;

type RolesObj = Partial<Record<Roles, boolean>>;

type RolesType = RolesObj | string[] | string;

export { Roles, RolesObj, RolesType };
