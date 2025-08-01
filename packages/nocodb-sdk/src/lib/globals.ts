import { ColumnType, FilterType } from './Api';
import { OrgUserRoles, ProjectRoles, WorkspaceUserRoles } from './enums';
import { PlanTitles } from './payment';

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
  DISCUSSION: 'discussion',
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
  FORBIDDEN = 'FORBIDDEN',
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
  FORMULA_CIRCULAR_REF_ERROR = 'FORMULA_CIRCULAR_REF_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_ATTACHMENT_UPLOAD_SCOPE = 'INVALID_ATTACHMENT_UPLOAD_SCOPE',
  CANNOT_CALCULATE_INTERMEDIATE_ORDER = 'CANNOT_CALCULATE_INTERMEDIATE_ORDER',
  REORDER_FAILED = 'REORDER_FAILED',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  SSO_LOGIN_REQUIRED = 'SSO_LOGIN_REQUIRED',
  SSO_GENERATED_TOKEN_REQUIRED = 'SSO_GENERATED_TOKEN_REQUIRED',
  MAX_INSERT_LIMIT_EXCEEDED = 'MAX_INSERT_LIMIT_EXCEEDED',
  INVALID_VALUE_FOR_FIELD = 'INVALID_VALUE_FOR_FIELD',
  MAX_WORKSPACE_LIMIT_REACHED = 'MAX_WORKSPACE_LIMIT_REACHED',
  BASE_USER_ERROR = 'BASE_USER_ERROR',
  PROHIBITED_SYNC_TABLE_OPERATION = 'PROHIBITED_SYNC_TABLE_OPERATION',
  INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY',
  DASHBOARD_NOT_FOUND = 'DASHBOARD_NOT_FOUND',
  WIDGET_NOT_FOUND = 'WIDGET_NOT_FOUND',
  INVALID_SHARED_DASHBOARD_PASSWORD = 'INVALID_SHARED_DASHBOARD_PASSWORD',
}

export enum ROW_COLORING_MODE {
  FILTER = 'filter',
  SELECT = 'select',
}

export const LongTextAiMetaProp = 'ai';

export const NO_SCOPE = 'nc';

export const NON_SEAT_ROLES = [
  WorkspaceUserRoles.NO_ACCESS,
  WorkspaceUserRoles.VIEWER,
  WorkspaceUserRoles.COMMENTER,
  ProjectRoles.NO_ACCESS,
  ProjectRoles.VIEWER,
  ProjectRoles.COMMENTER,
];

export const DURATION_TYPE_MAP = {
  0: 'h:mm',
  1: 'h:mm:ss',
  2: 'h:mm:ss.s',
  3: 'h:mm:ss.ss',
  4: 'h:mm:ss.sss',
  'h:mm': 0,
  'h:mm:ss': 1,
  'h:mm:ss.s': 2,
  'h:mm:ss.ss': 3,
  'h:mm:ss.sss': 4,
};

export const CURRENT_USER_TOKEN = '@me';

// this type makes every parameter inside an object be optional
// useful for where / insert / update query
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type RowColoringInfoFilterRow = {
  id: string;
  is_set_as_background: boolean;
  nc_order: number;
  color: string;
  conditions: FilterType[];
  nestedConditions: FilterType[];
};

export type RowColoringInfoSelect = {
  mode: ROW_COLORING_MODE.SELECT;
  fk_column_id: string;
  options: { title: string; color: string }[];
  selectColumn: ColumnType;
  is_set_as_background: boolean;
};
export type RowColoringInfoFilter = {
  mode: ROW_COLORING_MODE.FILTER;
  conditions: RowColoringInfoFilterRow[];
};

export type RowColoringInfo = {
  fk_model_id: string;
  fk_view_id: string;
} & (RowColoringInfoSelect | RowColoringInfoFilter);

type Roles = OrgUserRoles | ProjectRoles | WorkspaceUserRoles;

type RolesObj = Partial<Record<Roles, boolean>>;

type RolesType = RolesObj | string[] | string;

interface PlanLimitExceededDetailsType {
  plan?: PlanTitles;
  limit?: number;
  current?: number;
  higherPlan?: PlanTitles;
}

export { Roles, RolesObj, RolesType, PlanLimitExceededDetailsType };

export type RowColoringMode = null | 'SELECT' | 'FILTER';
